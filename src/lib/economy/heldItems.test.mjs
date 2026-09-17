import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./heldItems.js", import.meta.url), "utf8");
const heldItems = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const { getHeldItemStock, normalizePokemonHeldItem, planHeldItemChange, validateHeldItemAssignments } = heldItems;

const pokemon = (id, heldItem = null, type = "electric") => ({ id, name: `pokemon-${id}`, type, types: [{ type: { name: type } }], heldItem });
const economy = (inventory) => ({ inventory });

test("owned inventory includes equipped copies while available stock subtracts reservations", () => {
  assert.deepEqual(getHeldItemStock({ economy: economy({ oran: 2 }), collection: [pokemon(25, "oran"), pokemon(6)], itemId: "oran" }), { itemId: "oran", owned: 2, equipped: 1, available: 1 });
});

test("one physical copy cannot be equipped twice", () => {
  const collection = [pokemon(25, "oran"), pokemon(6)];
  assert.equal(planHeldItemChange({ pokemonId: 6, requestedItem: "oran", economy: economy({ oran: 1 }), collection }).reason, "not-available");
  assert.equal(planHeldItemChange({ pokemonId: 6, requestedItem: "oran", economy: economy({ oran: 2 }), collection }).ok, true);
});

test("replacement and unequip do not consume inventory", () => {
  const collection = [pokemon(25, "oran")];
  const player = economy({ oran: 1, sitrus: 1 });
  const replacement = planHeldItemChange({ pokemonId: 25, requestedItem: "sitrus", economy: player, collection });
  assert.equal(replacement.previousHeldItem, "oran");
  assert.equal(replacement.pokemon.heldItem, "sitrus");
  assert.deepEqual(replacement.economy.inventory, player.inventory);
  const removed = planHeldItemChange({ pokemonId: 25, requestedItem: null, economy: player, collection: replacement.collection });
  assert.equal(removed.pokemon.heldItem, null);
  assert.deepEqual(removed.economy.inventory, player.inventory);
});

test("invalid categories and missing Pokemon return structured failures", () => {
  assert.equal(planHeldItemChange({ pokemonId: 25, requestedItem: "potion", economy: economy({ potion: 2 }), collection: [pokemon(25)] }).reason, "invalid-item");
  assert.equal(planHeldItemChange({ pokemonId: 999, requestedItem: "oran", economy: economy({ oran: 1 }), collection: [pokemon(25)] }).reason, "pokemon-not-found");
});

test("legacy fields normalize to one canonical heldItem representation", () => {
  assert.equal(normalizePokemonHeldItem({ ...pokemon(25), heldItem: undefined, held_item: "oran" }), "oran");
  assert.equal(normalizePokemonHeldItem({ ...pokemon(6, null, "fire"), heldItem: undefined, equippedItem: "type-boost" }), "fire-boost");
  assert.equal(normalizePokemonHeldItem({ ...pokemon(7), heldItem: undefined, item: "potion" }), null);
});

test("assignment validation detects legacy over-reservation", () => {
  const invalid = validateHeldItemAssignments({ economy: economy({ oran: 1 }), collection: [pokemon(25, "oran"), pokemon(6, "oran", "fire")] });
  assert.deepEqual(invalid.map((item) => item.itemId), ["oran"]);
});
