import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./pvpConnection.js", import.meta.url), "utf8");
const connection = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("PvP connection states separate subscribe, presence sync, connection and failure", () => {
  assert.equal(connection.getSubscribeConnectionState("SUBSCRIBED"), connection.PVP_CONNECTION.SUBSCRIBED);
  assert.equal(connection.getSubscribeConnectionState("TIMED_OUT"), connection.PVP_CONNECTION.ERROR);
  assert.equal(connection.getSubscribeConnectionState("CHANNEL_ERROR"), connection.PVP_CONNECTION.ERROR);
  assert.equal(connection.getSubscribeConnectionState("CLOSED"), connection.PVP_CONNECTION.CLOSED);
  assert.equal(connection.getSubscribeConnectionState("JOINING"), connection.PVP_CONNECTION.CONNECTING);
  assert.match(connection.getPvpConnectionMessage(connection.PVP_CONNECTION.CLOSED), /encerrada/i);
  assert.match(connection.getPvpConnectionMessage(connection.PVP_CONNECTION.ERROR), /não foi possível/i);
});

test("room topics are stable across case and whitespace variations", () => {
  assert.equal(connection.normalizePvpRoomCode(" pkdx-2301 "), "PKDX-2301");
  assert.equal(connection.getPvpChannelTopic("pkdx-2301"), "battle:PKDX-2301");
});

test("Presence tracking only accepts acknowledged current SDK results", () => {
  assert.equal(connection.isTrackSuccessful("ok"), true);
  assert.equal(connection.isTrackSuccessful({ status: "ok" }), true);
  assert.equal(connection.isTrackSuccessful("timed out"), false);
});
