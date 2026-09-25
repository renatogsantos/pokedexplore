import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./progression.js", import.meta.url), "utf8");
const progressionSource = source.replace('import { normalizePokemonHeldItem } from "@/lib/economy/heldItems";', 'const normalizePokemonHeldItem = (pokemon) => pokemon?.heldItem ?? pokemon?.held_item ?? null;');
const { MAX_POKEMON_LEVEL, calculateLeveledStat, getPokemonLevel, getStatMultiplier, normalizeCapturedPokemon } = await import(`data:text/javascript;base64,${Buffer.from(progressionSource).toString("base64")}`);

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
  assert.deepEqual(legacy.baseStats, { hp: 35, attack: 55, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 });
  assert.equal(legacy.heldItem, null);
});

test("malformed legacy shapes cannot call array methods during battle normalization", () => {
  const legacy = normalizeCapturedPokemon({
    pokemonId: 25,
    displayName: "Pikachu antigo",
    stats: { hp: 35 },
    types: { primary: "electric" },
    moveset: { id: "thunder-shock" },
  });
  assert.equal(legacy.id, 25);
  assert.equal(legacy.name, "Pikachu antigo");
  assert.deepEqual(legacy.types, []);
  assert.deepEqual(legacy.stats, []);
  assert.deepEqual(legacy.moveset, []);
  assert.equal(legacy.saveVersion, 4);
});
