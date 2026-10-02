import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
const connectionSource = await readFile(new URL("./pvpConnection.js", import.meta.url), "utf8");
globalThis.__pvpConnectionForRealtimeTest = await import(`data:text/javascript;base64,${Buffer.from(connectionSource).toString("base64")}`);
const tracks = [];
const sent = [];
const listeners = new Map();
let subscribeCallback;
const channel = {
  on(kind, filter, callback) { listeners.set(`${kind}:${filter.event}`, callback); return this; },
  subscribe(callback) { subscribeCallback = callback; return this; },
  track(snapshot) { tracks.push(snapshot); return Promise.resolve("ok"); },
  send(message) { sent.push(message); return Promise.resolve("ok"); },
  presenceState() { return {}; },
};
globalThis.__createClientForRealtimeTest = () => ({ channel: () => channel, removeChannel: () => Promise.resolve() });
const source = (await readFile(new URL("./realtime.js", import.meta.url), "utf8"))
  .replace('import { createUuid } from "@/lib/runtime/uuid";', `import { createUuid } from "${new URL("../runtime/uuid.js", import.meta.url).href}";`)
  .replace('import { createClient } from "@supabase/supabase-js";', "const createClient = globalThis.__createClientForRealtimeTest;")
  .replace(/import\s*\{[\s\S]*?\}\s*from "@\/lib\/battle\/pvpConnection";/,
    "const { PVP_CONNECTION, getPvpChannelTopic, getSubscribeConnectionState, isTrackSuccessful, normalizePvpRoomCode } = globalThis.__pvpConnectionForRealtimeTest;");
const { createBattleRoom } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey;

test("partial Presence updates and reconnect preserve READY, team and timer", async () => {
  const room = createBattleRoom("PKDX-1234", { id: "player-1", name: "Player" });
  subscribeCallback("SUBSCRIBED");
  await room.updatePresence({ ready: true, team: [{ id: 1 }] });
  await room.updatePresence({ selectionTiming: { id: "selection-1" } });
  assert.equal(tracks.at(-1).ready, true);
  assert.deepEqual(tracks.at(-1).team, [{ id: 1 }]);
  assert.equal(tracks.at(-1).selectionTiming.id, "selection-1");
  subscribeCallback("SUBSCRIBED");
  await room.updatePresence({});
  assert.equal(tracks.at(-1).ready, true);
  assert.deepEqual(tracks.at(-1).team, [{ id: 1 }]);
  await room.leave();
});

test("same-value Presence updates do not produce track/sync feedback", async () => {
  const room = createBattleRoom("pkdx-1234", { id: "player-1", role: "guest" });
  subscribeCallback("SUBSCRIBED");
  await room.updatePresence({ selectionTiming: { id: "timer-1" } });
  const count = tracks.length;
  for (let i = 0; i < 30; i++) await room.updatePresence({ selectionTiming: { id: "timer-1" } });
  assert.equal(tracks.length, count);
  assert.equal(room.topic, "battle:PKDX-1234");
  await room.leave();
});

test("subscribe requests a recoverable snapshot and rejects mixed room/version messages", async () => {
  const events = [], requests = [], statuses = [];
  const room = createBattleRoom("PKDX-1234", { id: "host", role: "host" }, { onEvent: event => events.push(event), onStateRequest: id => requests.push(id), onStatus: status => statuses.push(status) });
  await assert.rejects(room.updatePresence({ ready: true }));
  subscribeCallback("SUBSCRIBED");
  await room.updatePresence({});
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(sent.some(message => message.payload.type === "state_request" && message.payload.roomId === "PKDX-1234"));
  const receive = listeners.get("broadcast:battle");
  receive({ payload: { type: "state_request", protocolVersion: 2, roomId: "PKDX-1234", senderPlayerId: "guest" } });
  assert.deepEqual(requests, ["guest"]);
  receive({ payload: { type: "battle_start", roomId: "OTHER", protocolVersion: 2 } });
  receive({ payload: { type: "battle_start", roomId: "PKDX-1234", protocolVersion: 1 } });
  assert.equal(events.length, 0); assert.equal(statuses.at(-1), "ERROR");
  await room.leave();
  const statusCount = statuses.length;
  subscribeCallback("SUBSCRIBED"); receive({ payload: { type: "state_request", protocolVersion: 2, roomId: "PKDX-1234", senderPlayerId: "guest" } });
  assert.equal(statuses.length, statusCount); assert.equal(requests.length, 1);
});

test("late cleanup and callbacks cannot close a newer room", async () => {
  const oldStatuses = [], nextStatuses = [];
  const first = createBattleRoom("PKDX-1111", { id: "host" }, { onStatus: status => oldStatuses.push(status) });
  const oldSubscribe = subscribeCallback;
  const next = createBattleRoom("PKDX-2222", { id: "host" }, { onStatus: status => nextStatuses.push(status) });
  const newSubscribe = subscribeCallback;
  await first.leave(); oldSubscribe("SUBSCRIBED");
  assert.equal(oldStatuses.length, 0);
  newSubscribe("SUBSCRIBED"); await next.updatePresence({});
  assert.equal(next.isConnected(), true);
  assert.notEqual(first.instanceId, next.instanceId);
  await next.leave();
});

test("missing subscription settles as an explicit connection error", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const statuses = [];
  const room = createBattleRoom("PKDX-1234", { id: "host" }, { onStatus: (state, detail) => statuses.push({ state, detail }) });
  t.mock.timers.tick(15001);
  assert.equal(statuses.at(-1).state, "ERROR");
  assert.equal(statuses.at(-1).detail.reason, "CONNECTION_TIMEOUT");
  await room.leave();
});
test("reconnect is not stranded behind a track promise from the previous transport", async () => {
  const trackBefore = channel.track;
  try {
    channel.track = () => new Promise(() => {});
    const states = [];
    const room = createBattleRoom("PKDX-1234", { id: "host" }, { onStatus: state => states.push(state) });
    subscribeCallback("SUBSCRIBED");
    await new Promise(resolve => setImmediate(resolve));
    subscribeCallback("CHANNEL_ERROR");
    channel.track = trackBefore;
    subscribeCallback("SUBSCRIBED");
    await room.updatePresence({ ready: true, team: [{ id: 1 }] });
    assert.equal(states.at(-1), "CONNECTED");
    await room.leave();
  } finally { channel.track = trackBefore; }
});
test("joining an empty topic does not wait forever for an absent host", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const statuses = [];
  const room = createBattleRoom("PKDX-9999", { id: "guest", role: "guest" }, { onStatus: (state, detail) => statuses.push({ state, detail }) });
  subscribeCallback("SUBSCRIBED"); await room.updatePresence({});
  await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(15001);
  assert.equal(statuses.at(-1).state, "ERROR");
  assert.equal(statuses.at(-1).detail.reason, "HOST_NOT_PRESENT");
  await room.leave();
});
