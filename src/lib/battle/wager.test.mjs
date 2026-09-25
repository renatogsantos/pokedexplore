import assert from "node:assert/strict";
import test from "node:test";
import { canStartWagerBattle, getWagerPot, normalizeWagerAmount } from "./wager.js";

test("wager amounts only accept safe positive integers", () => {
  assert.equal(normalizeWagerAmount(500), 500);
  assert.equal(normalizeWagerAmount("250"), 250);
  assert.equal(normalizeWagerAmount(0), 0);
  assert.equal(normalizeWagerAmount(-1), 0);
  assert.equal(normalizeWagerAmount(12.5), 0);
  assert.equal(normalizeWagerAmount(Infinity), 0);
});

test("a locked wager alone unlocks PvP start and its pot is exact", () => {
  assert.equal(canStartWagerBattle(null), true);
  assert.equal(canStartWagerBattle({ status: "PROPOSED" }), false);
  assert.equal(canStartWagerBattle({ status: "LOCKED" }), true);
  assert.equal(getWagerPot({ amount: 500 }), 1000);
});
