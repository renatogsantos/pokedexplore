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
let subscribeCallback;
const channel = {
  on() { return this; },
  subscribe(callback) { subscribeCallback = callback; return this; },
  track(snapshot) { tracks.push(snapshot); return Promise.resolve("ok"); },
  presenceState() { return {}; },
};
globalThis.__createClientForRealtimeTest = () => ({ channel: () => channel, removeChannel: () => Promise.resolve() });
const source = (await readFile(new URL("./realtime.js", import.meta.url), "utf8"))
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
