import assert from "node:assert/strict";
import test from "node:test";
import { JOURNEY_MEDALS, JOURNEY_ROUTES, getJourneyBattle, isJourneyNodeUnlocked, resolveJourneyLoot } from "./index.js";

test("Journey routes are three-battle expeditions and preserve the chapter gate", () => {
  assert.equal(JOURNEY_ROUTES.every((route) => route.battles.length === 3), true);
  assert.equal(getJourneyBattle("route-1", 3).kind, "boss");
  assert.equal(isJourneyNodeUnlocked("route-1", []), true);
  assert.equal(isJourneyNodeUnlocked("route-2", []), false);
  assert.equal(isJourneyNodeUnlocked("route-2", ["route-1"]), true);
  assert.equal(isJourneyNodeUnlocked("champion-challenge", JOURNEY_ROUTES.slice(0, -1).map((route) => route.id), JOURNEY_MEDALS.map((medal) => medal.id)), true);
});

test("Journey loot is deterministic and replay rewards are smaller", () => {
  const route = JOURNEY_ROUTES[2];
  const first = resolveJourneyLoot({ route, battleIndex: 3, runId: "run-1", firstClear: true, chest: true });
  const repeated = resolveJourneyLoot({ route, battleIndex: 3, runId: "run-1", firstClear: false, chest: true });
  assert.deepEqual(first, resolveJourneyLoot({ route, battleIndex: 3, runId: "run-1", firstClear: true, chest: true }));
  assert.ok(first.coins > repeated.coins);
  assert.match(first.id, /^journey:run-1:water-gym:3:chest$/);
});
