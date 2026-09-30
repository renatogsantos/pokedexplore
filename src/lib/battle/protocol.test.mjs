import assert from "node:assert/strict";
import test from "node:test";
import { canApplyBattleSnapshot, canResolveRemoteAction } from "./protocol.js";

const state = (revision, status = "playing", matchId = "match-1") => ({
  matchId, revision, status, turn: "guest", host: { id: "host" }, guest: { id: "guest" },
});
const options = { localRole: "guest", playerId: "guest" };

test("guest applies only current authoritative snapshots in revision and phase order", () => {
  assert.equal(canApplyBattleSnapshot(null, state(0, "countdown"), options), true);
  assert.equal(canApplyBattleSnapshot(state(0, "countdown"), state(0, "playing"), options), true);
  assert.equal(canApplyBattleSnapshot(state(2), state(1), options), false);
  assert.equal(canApplyBattleSnapshot(state(2), state(2), options), false);
  assert.equal(canApplyBattleSnapshot(state(2), state(3, "finished"), options), true);
  assert.equal(canApplyBattleSnapshot(state(2), state(3, "playing", "old-match"), options), false);
  assert.equal(canApplyBattleSnapshot(null, state(0), { ...options, retiredMatchIds: new Set(["match-1"]) }), false);
  assert.equal(canApplyBattleSnapshot(null, state(0), { localRole: "host", playerId: "host" }), false);
});

test("guest intents require the current match, turn, revision and unique action ID", () => {
  const action = { type: "attack", moveId: "hit", matchId: "match-1", expectedRevision: 4, actionId: "intent-1" };
  assert.equal(canResolveRemoteAction(state(4), action), true);
  assert.equal(canResolveRemoteAction(state(5), action), false);
  assert.equal(canResolveRemoteAction(state(4), { ...action, matchId: "old-match" }), false);
  assert.equal(canResolveRemoteAction(state(4), { ...action, actionId: null }), false);
  assert.equal(canResolveRemoteAction({ ...state(4), turn: "host" }, action), false);
});
