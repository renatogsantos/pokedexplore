import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ITEM_CATALOG, getItemDefinition, isDurableItem, getItemUsagePresentation } from "../items/catalog.js";
import { migrateDurableEquipment, normalizeDurableInventory, resolveDurableEquipment, getEquippedDurableInstances, settleEquipmentWear, isEligibleForEquipmentWear, bindEquipmentCopy, EQUIPMENT_FIELDS, resizeDurableInventory } from "./durableEquipment.js";
async function domain(file) {
  let source = await readFile(new URL(file, import.meta.url), "utf8");
  source = source.replace(/"@\/lib\/([^"\n]+)"/g, (_, path) => JSON.stringify(new URL(`../${path}.js`, import.meta.url).href));
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}
const { planHeldItemChange, normalizePokemonEquipment, getEquipmentItemStates, validateHeldItemAssignments } = await domain("./heldItems.js");
const { createBattleState, calculateDamage, getDamagePreview, resolveAction } = await domain("../battle/engine.js");
const field = EQUIPMENT_FIELDS[1];
function fixture(quantity = 1) {
  return migrateDurableEquipment({ inventory: { "perola-abissal": quantity } }, [{ id: 8, name: "Wartortle", types: ["water"], type: "water", elementalRelic: "perola-abissal", heldItem: null, strategicItem: null, maxHp: 100, hp: 100, stats: { attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 }, equipmentVersion: 1 }]);
}
function result(collection, matchId = "cpu:1", winner = "host", role = "host") {
  return { matchId, status: "finished", winner, performance: { startedAt: 1, endedAt: 100 }, [role]: { id: "player-A", team: collection }, equipmentSnapshot: { [role]: getEquippedDurableInstances(collection) } };
}
function wear(f, matchId = "cpu:1", winner = "host") { return settleEquipmentWear(f.economy, f.collection, result(f.collection, matchId, winner), "host"); }

test("audited lifecycle preserves all effects, prices, rarity and trigger metadata", async () => {
  assert.equal(ITEM_CATALOG.filter(isDurableItem).length, 28);
  assert.equal(ITEM_CATALOG.filter(i => i.lifecycle === "SINGLE_USE").length, 15);
  assert.equal(ITEM_CATALOG.filter(i => i.lifecycle === "BAG").length, 15);
  for (const item of ITEM_CATALOG) {
    const { lifecycle, durabilityMax, ...unchanged } = item;
    if (isDurableItem(item)) assert.equal(getItemUsagePresentation(item).persistenceLabel, "DURÁVEL");
    if (isDurableItem(item)) assert.equal(item.durabilityMax, 5);
  }
  const unchanged = ITEM_CATALOG.map(({ lifecycle, durabilityMax, ...entry }) => entry);
  assert.equal(createHash("sha256").update(JSON.stringify(unchanged)).digest("hex"), "dadae268d40f4e1bd79178a9939cbd4db9c1cfdf3474812c286c2d69d6f30c17");
  assert.equal(getItemDefinition("phoenix-heart").lifecycle, "SINGLE_USE");
  assert.equal(getItemDefinition("guardian-plate").lifecycle, "SINGLE_USE");
});
for (const quantity of [1, 3]) test(`migration preserves quantity ${quantity} and binds one existing copy idempotently`, () => {
  const f = fixture(quantity);
  assert.equal(Object.keys(f.economy.durableItems).length, quantity);
  assert.equal(f.economy.inventory["perola-abissal"], quantity);
  assert.ok(f.collection[0].elementalRelicInstanceId);
  assert.deepEqual(migrateDurableEquipment(f.economy, f.collection), f);
});
test("legacy aliases, dual slots and consumables migrate independently without extras", () => {
  const raw = [{ id: 8, types: ["water"], heldItemId: "power-claw", elementalRelicId: "perola-abissal" }, { id: 1, held_item: "oran" }, { id: 4 }];
  const normalized = raw.map(p => ({ ...p, ...normalizePokemonEquipment(p) }));
  const f = migrateDurableEquipment({ inventory: { "power-claw": 1, "perola-abissal": 1, "fruit-vital": 1 } }, normalized);
  assert.equal(Object.keys(f.economy.durableItems).length, 2);
  assert.ok(f.collection[0].strategicItemInstanceId);
  assert.ok(f.collection[0].elementalRelicInstanceId);
  assert.equal(f.collection[1].strategicItem, "fruit-vital");
  assert.deepEqual(migrateDurableEquipment(f.economy, f.collection), f);
});
test("purchase grants fresh independent copies without resetting old durability", () => {
  const f = wear(fixture());
  const next = normalizeDurableInventory({ ...f.economy, inventory: { "perola-abissal": 2 } });
  assert.deepEqual(Object.values(next.durableItems).map(copy => copy.durability).sort(), [4,5]);
  assert.deepEqual(normalizeDurableInventory(next), next);
});
test("one instance cannot be equipped twice and current owner remains selectable", () => {
  const f = fixture(); f.collection.push({ id: 9, types: ["water"] });
  const instanceId = f.collection[0].elementalRelicInstanceId;
  assert.equal(planHeldItemChange({ pokemonId: 9, requestedItem: { id: "perola-abissal", instanceId }, economy: f.economy, collection: f.collection, slot: "ELEMENTAL_RELIC" }).ok, false);
  const options = getEquipmentItemStates({ pokemon: f.collection[0], economy: f.economy, collection: f.collection, slot: "ELEMENTAL_RELIC" });
  assert.equal(options.find(entry => entry.copy?.instanceId === instanceId).equippedOnCurrent, true);
});
test("five completed battles break only committed copy, no automatic spare replacement", () => {
  let f = fixture(2); const equippedId = f.collection[0].elementalRelicInstanceId;
  const spareId = Object.keys(f.economy.durableItems).find(id => id !== equippedId);
  for (let n = 1; n <= 5; n++) {
    const state = result(f.collection, `cpu:${n}`);
    const original = structuredClone(state);
    f = settleEquipmentWear(f.economy, f.collection, state, "host");
    assert.deepEqual(state, original);
    assert.equal(f.changes[0].durabilityAfter, 5 - n);
    assert.equal(f.economy.durableItems[spareId].durability, 5);
  }
  assert.equal(f.collection[0].elementalRelic, null);
  assert.equal(f.collection[0].elementalRelicInstanceId, null);
  assert.equal(f.economy.durableItems[equippedId], undefined);
  assert.equal(f.economy.inventory["perola-abissal"], 1);
  assert.equal(migrateDurableEquipment(f.economy, f.collection).collection[0].elementalRelic, null);
  const plan = planHeldItemChange({ pokemonId: 8, requestedItem: { id: "perola-abissal", instanceId: spareId }, economy: f.economy, collection: f.collection, slot: "ELEMENTAL_RELIC" });
  assert.equal(plan.pokemon.elementalRelicInstanceId, spareId);
});
test("duplicate results and duplicate snapshot entries cannot wear twice", () => {
  const f = fixture(); const state = result(f.collection);
  state.equipmentSnapshot.host.push(state.equipmentSnapshot.host[0]);
  const first = settleEquipmentWear(f.economy, f.collection, state, "host");
  assert.equal(first.changes.length, 1);
  const repeated = settleEquipmentWear(first.economy, first.collection, structuredClone(state), "host");
  assert.equal(repeated.duplicate, true); assert.deepEqual(repeated.economy, first.economy);
});
for (const reason of ["countdown", "playing", "cancelled", "unstarted", "connection failure", "no final winner"]) test(`${reason} has no wear`, () => {
  const f = fixture(); const state = result(f.collection);
  if (["countdown", "playing", "cancelled"].includes(reason)) state.status = reason;
  if (["unstarted", "connection failure"].includes(reason)) state.performance.startedAt = null;
  if (reason === "no final winner") state.winner = null;
  assert.equal(isEligibleForEquipmentWear(state, "host"), false);
  assert.deepEqual(settleEquipmentWear(f.economy, f.collection, state, "host").economy, f.economy);
});
test("activation count, inactive team members, defeat and equipment changes do not avoid wear", () => {
  const f = fixture(); const state = result(f.collection, "loss", "guest");
  state.effect = { itemEvents: Array.from({ length: 12 }, () => ({ itemId: "perola-abissal" })) };
  const unequipped = [{ ...f.collection[0], elementalRelic: null, elementalRelicInstanceId: null }];
  const settled = settleEquipmentWear(f.economy, unequipped, state, "host");
  assert.equal(settled.changes[0].durabilityAfter, 4);
});
test("two slots wear independently while single-use remains quantity-based", () => {
  let f = fixture();
  f = migrateDurableEquipment({ ...f.economy, inventory: { ...f.economy.inventory, "power-claw": 1 }, durableEquipmentVersion: 0 }, [{ ...f.collection[0], strategicItem: "power-claw" }]);
  const settled = wear(f); assert.equal(settled.changes.length, 2);
  const consumable = [{ ...f.collection[0], strategicItem: "phoenix-heart", heldItem: "phoenix-heart", strategicItemInstanceId: null }];
  assert.equal(getEquippedDurableInstances(consumable).length, 1);
});
for (const scenario of [["Tournament H×H",2], ["Tournament H×CPU",2], ["Badge",3], ["Journey",3], ["Rematch",2]]) test(`${scenario[0]} settles per actual match identity`, () => {
  let f = fixture(); for (let n=1;n<=scenario[1];n++) f = wear(f, `${scenario[0]}:${n}`);
  assert.equal(Object.values(f.economy.durableItems)[0].durability, 5-scenario[1]);
});
test("PvP settles host and guest in independent economies", () => {
  const host = fixture(), guest = fixture();
  const state = result(host.collection, "pvp");
  state.guest = { id: "player-B", team: guest.collection };
  state.equipmentSnapshot.guest = getEquippedDurableInstances(guest.collection);
  const hostResult = settleEquipmentWear(host.economy, host.collection, state, "host");
  const guestResult = settleEquipmentWear(guest.economy, guest.collection, state, "guest");
  assert.equal(Object.values(hostResult.economy.durableItems)[0].durability,4);
  assert.equal(Object.values(guestResult.economy.durableItems)[0].durability,4);
  assert.equal(Object.values(guest.economy.durableItems)[0].durability,5);
  const cpuState = { ...state, guest: { id: "cpu" } };
  assert.equal(isEligibleForEquipmentWear(cpuState, "guest"), false);
});
test("missing/broken copies are ignored and explicit empty slots never resurrect legacy aliases", () => {
  const f = fixture(); const p = f.collection[0];
  assert.equal(resolveDurableEquipment(p, { durableItems: {} }).elementalRelic, null);
  assert.equal(normalizePokemonEquipment({ heldItemId: "power-claw", strategicItem: null }).strategicItem, null);
  assert.equal(normalizePokemonEquipment({ strategicItemId: "power-claw", strategicItem: null }).strategicItem, null);
  assert.equal(normalizePokemonEquipment({ elementalRelicId: "perola-abissal", elementalRelic: null }).elementalRelic, null);
  const id = p.elementalRelicInstanceId;
  const corrupted = { ...f.economy, durableItems: { [id]: { ...f.economy.durableItems[id], durability: 0 } } };
  assert.equal(Object.keys(normalizeDurableInventory(corrupted).durableItems).length, 0);
});
test("1/5 relic works throughout real engine CPU match and preview never wears", () => {
  let f = fixture(); const id = f.collection[0].elementalRelicInstanceId;
  f.economy.durableItems[id].durability = 1;
  f.collection[0] = bindEquipmentCopy(f.collection[0], field, f.economy.durableItems[id]);
  const opponent = { ...f.collection[0], id: 4, type: "fire", types: ["fire"], elementalRelic: null, elementalRelicInstanceId: null, equipmentDurability: {} };
  let battle = createBattleState({ id: "player-A", team: f.collection }, { id: "cpu", team: [opponent] });
  battle.matchId = "real-cpu"; battle.performance.startedAt = 1;
  battle.equipmentSnapshot = { host: getEquippedDurableInstances(battle.host.team), guest: [] };
  const move = { id: "water-test", name: "Water Test", type: "water", power: 100, accuracy: 100, damageClass: "special", makesContact: false };
  const attacker = battle.host.team[0], defender = battle.guest.team[0];
  const damage = calculateDamage({ attacker, defender, move, variance: 1 }).damage;
  assert.ok(damage > calculateDamage({ attacker: { ...attacker, elementalRelic: null }, defender, move, variance: 1 }).damage);
  const before = structuredClone(f.economy);
  getDamagePreview({ attacker, defender, move }); assert.deepEqual(f.economy, before);
  for (let turn=0; turn<300 && battle.status === "playing"; turn++) {
    const role = battle.turn;
    battle = resolveAction(battle, role, { type: "attack", moveId: battle[role].team[0].moves.find(m => !m.special)?.id || battle[role].team[0].moves[0].id, actionId: `turn:${turn}` });
  }
  assert.equal(battle.status, "finished");
  assert.equal(battle.host.team[0].equipmentDurability.ELEMENTAL_RELIC.durability, 1);
  const settled = settleEquipmentWear(f.economy, f.collection, battle, "host");
  assert.equal(settled.changes[0].broken, true);
});
test("modern battle initialization and damage preview reject invalid copies", () => {
  const f = fixture(); const p = f.collection[0];
  p.equipmentDurability.ELEMENTAL_RELIC.durability = 0;
  const battle = createBattleState({ id:"a", team:[p] }, { id:"cpu", team:[{...p,id:4}] });
  assert.equal(battle.host.team[0].elementalRelic, null);
  const preview = getDamagePreview({ attacker:p, defender:{...p,elementalRelic:null}, move:{type:"water",power:60,damageClass:"special"} });
  assert.equal(preview.resolution.itemTriggers.some(t=>t.itemId === "perola-abissal"), false);
});
test("quantity administration preserves reservations and never repairs existing copies", () => {
  const f = fixture(3); const reserved = new Set([f.collection[0].elementalRelicInstanceId]);
  const next = resizeDurableInventory({ ...f.economy, inventory:{"perola-abissal":1} }, "perola-abissal",1,reserved);
  assert.equal(Object.keys(next.durableItems).length,1);
  assert.ok(next.durableItems[f.collection[0].elementalRelicInstanceId]);
});

test("duplicated physical reference is rejected even when aggregate quantity is sufficient", () => {
  const f = fixture(2);
  const clone = { ...f.collection[0], id: 9 };
  assert.equal(validateHeldItemAssignments({ economy:f.economy, collection:[...f.collection,clone] }).some(issue=>issue.reason === "INVALID_INSTANCE"), true);
});
test("cleared slot discards orphan copy metadata and finite durability stays within max", () => {
  const f = fixture();const p=f.collection[0];
  const cleared = resolveDurableEquipment({...p,elementalRelic:null},f.economy);
  assert.equal(cleared.elementalRelicInstanceId,null);
  const id=p.elementalRelicInstanceId;
  const clamped=normalizeDurableInventory({...f.economy,durableItems:{[id]:{...f.economy.durableItems[id],durability:100}}});
  assert.equal(clamped.durableItems[id].durability,5);
  assert.equal(Object.keys(normalizeDurableInventory({inventory:{"perola-abissal":Infinity}}).durableItems).length,0);
});
