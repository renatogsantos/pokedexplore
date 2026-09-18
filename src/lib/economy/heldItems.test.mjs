import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const catalogSource = await readFile(new URL("../items/catalog.js", import.meta.url), "utf8");
globalThis.__itemCatalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString("base64")}`);
const source = (await readFile(new URL("./heldItems.js", import.meta.url), "utf8")).replace('import { HELD_ITEM_CATALOG, getItemDefinition, migrateLegacyItemId } from "@/lib/items/catalog";', "const { HELD_ITEM_CATALOG, getItemDefinition, migrateLegacyItemId } = globalThis.__itemCatalog;");
const { getHeldItemStock, normalizePokemonHeldItem, planHeldItemChange, validateHeldItemAssignments } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const pokemon = (id, heldItem = null) => ({ id, name: `pokemon-${id}`, heldItem });
const economy = (inventory) => ({ inventory });

test("owned inventory separates equipped reservations and available copies", () => {
  assert.deepEqual(getHeldItemStock({ economy: economy({ "fruit-vital": 2 }), collection: [pokemon(25, "fruit-vital"), pokemon(6)], itemId: "fruit-vital" }), { itemId: "fruit-vital", owned: 2, equipped: 1, available: 1 });
});

test("one physical copy cannot be equipped twice", () => {
  const collection = [pokemon(25, "fruit-vital"), pokemon(6)];
  assert.equal(planHeldItemChange({ pokemonId: 6, requestedItem: "fruit-vital", economy: economy({ "fruit-vital": 1 }), collection }).reason, "not-available");
  assert.equal(planHeldItemChange({ pokemonId: 6, requestedItem: "fruit-vital", economy: economy({ "fruit-vital": 2 }), collection }).ok, true);
});

test("replace and unequip reserve but never consume inventory", () => {
  const collection = [pokemon(25, "fruit-vital")]; const player = economy({ "fruit-vital": 1, "healing-core": 1 });
  const replacement = planHeldItemChange({ pokemonId: 25, requestedItem: "healing-core", economy: player, collection }); assert.equal(replacement.previousHeldItem, "fruit-vital"); assert.equal(replacement.pokemon.heldItem, "healing-core"); assert.deepEqual(replacement.economy.inventory, player.inventory);
  const removed = planHeldItemChange({ pokemonId: 25, requestedItem: null, economy: player, collection: replacement.collection }); assert.equal(removed.pokemon.heldItem, null); assert.deepEqual(removed.economy.inventory, player.inventory);
});

test("Bag items cannot be equipped and legacy held fields migrate", () => {
  assert.equal(planHeldItemChange({ pokemonId: 25, requestedItem: "vital-potion", economy: economy({ "vital-potion": 2 }), collection: [pokemon(25)] }).reason, "invalid-item");
  assert.equal(normalizePokemonHeldItem({ ...pokemon(25), heldItem: undefined, held_item: "oran" }), "fruit-vital");
  assert.equal(normalizePokemonHeldItem({ ...pokemon(6), heldItem: undefined, equippedItem: "fire-boost" }), "elemental-core");
  assert.equal(normalizePokemonHeldItem({ ...pokemon(7), heldItem: undefined, item: "potion" }), null);
});

test("assignment audit reports over-reserved item ids", () => {
  const invalid = validateHeldItemAssignments({ economy: economy({ "fruit-vital": 1 }), collection: [pokemon(25, "fruit-vital"), pokemon(6, "fruit-vital")] });
  assert.deepEqual(invalid.map((item) => item.itemId), ["fruit-vital"]);
});
