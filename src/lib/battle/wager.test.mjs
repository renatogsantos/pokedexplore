import assert from "node:assert/strict";
import test from "node:test";
import { canStartWagerBattle, getWagerPot, getWagerResult, normalizeWagerAmount } from "./wager.js";

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

test("wager result is derived from the authoritative winner and local role", () => {
  const wager = { amount: 500, status: "LOCKED" };
  assert.deepEqual(getWagerResult(wager, "host", "host"), { amount: 500, pot: 1000, net: 500, status: "WON" });
  assert.deepEqual(getWagerResult(wager, "host", "guest"), { amount: 500, pot: 1000, net: -500, status: "LOST" });
  assert.deepEqual(getWagerResult(wager, null, "guest"), { amount: 500, pot: 1000, net: 0, status: "REFUNDED" });
});
