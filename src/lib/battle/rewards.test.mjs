import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (await readFile(new URL("./rewards.js", import.meta.url), "utf8"))
  .replace('import { BADGE_CHAMPION_COIN_MULTIPLIER } from "@/lib/badges/config";', "const BADGE_CHAMPION_COIN_MULTIPLIER = 1.25;");
const { calculateBattleRewards } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("battle performance rewards are additive and keep the one-minute boundary strict", () => {
  assert.equal(calculateBattleRewards({ won: true, durationMs: 30_000, usedOnlyOnePokemon: false }).total, 30);
  assert.equal(calculateBattleRewards({ won: true, durationMs: 30_000, usedOnlyOnePokemon: true }).total, 60);
  assert.equal(calculateBattleRewards({ won: true, durationMs: 59_999, usedOnlyOnePokemon: true }).total, 60);
  assert.equal(calculateBattleRewards({ won: true, durationMs: 60_000, usedOnlyOnePokemon: true }).total, 45);
  assert.equal(calculateBattleRewards({ won: true, durationMs: 61_000, usedOnlyOnePokemon: true }).total, 45);
  assert.equal(calculateBattleRewards({ won: true, durationMs: 90_000, usedOnlyOnePokemon: false }).total, 15);
  assert.equal(calculateBattleRewards({ won: false, durationMs: 20_000, usedOnlyOnePokemon: true }).total, 0);
  assert.deepEqual(calculateBattleRewards({ won: true, durationMs: 30_000, usedOnlyOnePokemon: true, championBonusEligible: true }), { base: 15, bonuses: { fastVictory: 15, onePokemonVictory: 30, champion: 15 }, total: 75 });
  assert.equal(calculateBattleRewards({ won: true, durationMs: 90_000, usedOnlyOnePokemon: false, championBonusEligible: true }).total, 19);
});
