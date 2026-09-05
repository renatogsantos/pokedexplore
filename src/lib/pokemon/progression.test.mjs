import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./progression.js", import.meta.url), "utf8");
const { MAX_POKEMON_LEVEL, calculateLeveledStat, getPokemonLevel, getStatMultiplier, normalizeCapturedPokemon } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("levels use base stats without compounding and clamp at level ten", () => {
  assert.equal(calculateLeveledStat(100, 1), 100);
  assert.equal(calculateLeveledStat(100, 2), 105);
  assert.equal(calculateLeveledStat(100, 3), 110);
  assert.equal(getPokemonLevel({ level: 99 }), MAX_POKEMON_LEVEL);
  assert.equal(getStatMultiplier(10), 1.45);
});

test("legacy captured Pokemon normalize safely to level one with base stats", () => {
  const legacy = normalizeCapturedPokemon({ id: 25, stats: [{ stat: { name: "hp" }, base_stat: 35 }, { stat: { name: "attack" }, base_stat: 55 }] });
  assert.equal(legacy.level, 1);
  assert.deepEqual(legacy.baseStats, { hp: 35, attack: 55 });
});
