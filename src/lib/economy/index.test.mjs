import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("./index.js", import.meta.url), "utf8");
const rarityStub = `const POKEMON_RARITY = { NORMAL: "normal", LEGENDARY: "legendary", MYTHICAL: "mythical" }; const getPokemonRarity = (pokemon) => pokemon.rarity || POKEMON_RARITY.NORMAL;`;
const economySource = source.replace('import { getPokemonRarity, POKEMON_RARITY } from "@/lib/pokemon/rarity";', rarityStub);
const { COINS_PER_WIN, getPokemonBaseStatTotal, getPokemonPrice, getPurchaseLabel } = await import(`data:text/javascript;base64,${Buffer.from(economySource).toString("base64")}`);

const pokemon = (stats, extra = {}) => ({ stats: stats.map((base_stat) => ({ base_stat })), ...extra });

test("coins use a single centralized reward value", () => assert.equal(COINS_PER_WIN, 15));
test("price uses full base stat total and stays divisible by one victory", () => {
  const pikachu = pokemon([35, 55, 40, 50, 50, 90], { base_experience: 112 });
  assert.equal(getPokemonBaseStatTotal(pikachu), 320);
  assert.equal(getPokemonPrice(pikachu), 60);
  assert.equal(getPokemonPrice(pikachu) % COINS_PER_WIN, 0);
});
test("strength progresses through an evolution family", () => {
  const charmander = pokemon([39, 52, 43, 60, 50, 65], { base_experience: 62 });
  const charmeleon = pokemon([58, 64, 58, 80, 65, 80], { base_experience: 142 });
  const charizard = pokemon([78, 84, 78, 109, 85, 100], { base_experience: 267 });
  assert.ok(getPokemonPrice(charmander) < getPokemonPrice(charmeleon));
  assert.ok(getPokemonPrice(charmeleon) < getPokemonPrice(charizard));
});
test("rare Pokémon are placed in the intended expensive tiers", () => {
  const mewtwo = pokemon([106, 110, 90, 154, 90, 130], { base_experience: 340, rarity: "legendary" });
  const mew = pokemon([100, 100, 100, 100, 100, 100], { base_experience: 300, rarity: "mythical" });
  assert.equal(getPokemonPrice(mewtwo), 645);
  assert.equal(getPokemonPrice(mew), 870);
});
test("purchase labels make normal affordability and maximum level explicit", () => {
  assert.equal(getPurchaseLabel({ balance: 45, price: 60, level: 0, maxLevel: false }), "Faltam 15 moedas");
  assert.equal(getPurchaseLabel({ balance: 60, price: 60, level: 3, maxLevel: false }), "Comprar + nível");
  assert.equal(getPurchaseLabel({ balance: 999, price: 60, level: 10, maxLevel: true }), "Nível máximo");
});
