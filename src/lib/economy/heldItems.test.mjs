import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const catalogSource = await readFile(new URL("../items/catalog.js", import.meta.url), "utf8");
globalThis.__itemCatalog = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString("base64")}`);
const source = (await readFile(new URL("./heldItems.js", import.meta.url), "utf8")).replace(/import\s*\{[\s\S]*?\}\s*from\s*"@\/lib\/items\/catalog";/, "const { ELEMENTAL_RELICS_BY_TYPE, ELEMENTAL_RELIC_CATALOG, HELD_ITEM_CATALOG, STRATEGIC_ITEM_CATALOG, getItemDefinition, migrateLegacyItemId } = globalThis.__itemCatalog;");
const { EQUIPMENT_SLOT, buildEquipmentReservationIndex, canEquipElementalRelic, getEquipableItemsForSlot, getEquipmentInventoryState, getHeldItemStock, getPokemonTypes, normalizePokemonEquipment, normalizePokemonHeldItem, planHeldItemChange, validateHeldItemAssignments } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
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

test("elemental relics match canonical, API and legacy Pokemon type shapes", () => {
  assert.deepEqual(getPokemonTypes({ types: [], type: "water" }), ["water"]);
  assert.deepEqual(getPokemonTypes({ types: { primary: { type: { name: "water" } } } }), ["water"]);
  assert.deepEqual(getPokemonTypes({ types: [{ type: { name: "grass" } }, { type: { name: "poison" } }] }), ["grass", "poison"]);
  assert.equal(canEquipElementalRelic({ types: [], type: "water" }, "perola-abissal").allowed, true);
  assert.equal(canEquipElementalRelic({ types: ["grass", "poison"] }, "presa-toxica").allowed, true);
  assert.equal(canEquipElementalRelic({ types: ["grass", "poison"] }, "brasa-primordial").allowed, false);
  const relics = getEquipableItemsForSlot({ pokemon: { types: [], type: "water" }, slot: EQUIPMENT_SLOT.ELEMENTAL_RELIC });
  assert.deepEqual(relics.map((item) => item.id), ["perola-abissal"]);
  assert.equal(getEquipableItemsForSlot({ pokemon: { type: "water" }, slot: EQUIPMENT_SLOT.STRATEGIC }).some((item) => item.id === "perola-abissal"), false);
});

test("catalog keeps the three item concepts and all eighteen elemental types", () => {
  const items = globalThis.__itemCatalog.ITEM_CATALOG;
  const relics = items.filter((item) => item.equipmentSlot === EQUIPMENT_SLOT.ELEMENTAL_RELIC);
  assert.equal(relics.length, 18);
  assert.equal(new Set(relics.map((item) => item.elementalType)).size, 18);
  assert.ok(items.some((item) => item.usageType === "BAG"));
  assert.ok(items.some((item) => item.usageType === "HELD" && item.equipmentSlot === EQUIPMENT_SLOT.STRATEGIC));
  assert.ok(relics.every((item) => item.usageType === "HELD" && item.consumable === false && item.effectType === "ELEMENTAL_RELIC"));
});

test("relic inventory keeps the current assignment visible without duplicating it", () => {
  const collection = [{ id: 1, types: ["grass", "poison"], elementalRelic: "semente-ancestral" }, { id: 2, types: ["grass"], elementalRelic: null }];
  const current = getEquipmentInventoryState({ economy: economy({ "semente-ancestral": 1 }), collection, pokemonId: 1, itemId: "semente-ancestral" });
  const other = getEquipmentInventoryState({ economy: economy({ "semente-ancestral": 1 }), collection, pokemonId: 2, itemId: "semente-ancestral" });
  assert.equal(current.state, "CURRENTLY_EQUIPPED");
  assert.equal(current.available, 0);
  assert.equal(other.state, "ALL_RESERVED");
  assert.equal(other.available, 0);
});

test("reservation indexes avoid item-by-item collection scans for a large collection", () => {
  const collection = Array.from({ length: 1500 }, (_, id) => ({ id, heldItem: id % 3 === 0 ? "fruit-vital" : null, elementalRelic: id % 11 === 0 ? "semente-ancestral" : null }));
  const index = buildEquipmentReservationIndex(collection);
  assert.equal(index.get("fruit-vital"), 500);
  assert.equal(index.get("semente-ancestral"), 137);
  const stock = getHeldItemStock({ economy: economy({ "fruit-vital": 700 }), itemId: "fruit-vital", reservationIndex: index });
  assert.deepEqual(stock, { itemId: "fruit-vital", owned: 700, equipped: 500, available: 200 });
});

test("legacy relic ids migrate to the relic slot while strategic equipment stays independent", () => {
  assert.deepEqual(normalizePokemonEquipment({ heldItem: "semente-ancestral", strategicItem: "fruit-vital" }), { strategicItem: "fruit-vital", elementalRelic: "semente-ancestral" });
  const changed = planHeldItemChange({ pokemonId: 1, requestedItem: "presa-toxica", slot: EQUIPMENT_SLOT.ELEMENTAL_RELIC, economy: economy({ "semente-ancestral": 1, "presa-toxica": 1 }), collection: [{ id: 1, types: ["grass", "poison"], strategicItem: "fruit-vital", elementalRelic: "semente-ancestral" }] });
  assert.equal(changed.ok, true);
  assert.equal(changed.pokemon.strategicItem, "fruit-vital");
  assert.equal(changed.pokemon.elementalRelic, "presa-toxica");
});
