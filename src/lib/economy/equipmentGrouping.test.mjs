import test from 'node:test';
import assert from 'node:assert/strict';
import { getEquipmentItemStates, planHeldItemChange } from './heldItems.js';
import { migrateDurableEquipment } from './durableEquipment.js';
import { ITEM_CATALOG, isDurableItem } from '../items/catalog.js';

const id = 'resistance-crystal';
function fixture(durabilities = [5, 5, 5]) {
  return { economy: { durableEquipmentVersion: 1, inventory: { [id]: durabilities.length, 'fruit-vital': 8, 'vital-potion': 99 }, durableItems: Object.fromEntries(durabilities.map((durability, i) => [`copy:${i}`, { instanceId: `copy:${i}`, itemId: id, durability, maxDurability: 5 }])) }, collection: [{ id: 1, types: ['grass', 'poison'] }, { id: 2, types: ['grass'] }] };
}
const groups = f => getEquipmentItemStates({ ...f, pokemon: f.collection[0], slot: 'STRATEGIC' });
const crystal = f => groups(f).find(s => s.item.id === id);
test('three or nine real copies render one group without changing inventory', () => {
  for (const count of [3, 9]) {
    const f = fixture(Array(count).fill(5)), before = structuredClone(f);
    assert.equal(groups(f).filter(s => s.item.id === id).length, 1);
    assert.equal(crystal(f).owned, count); assert.equal(crystal(f).available, count);
    assert.equal(crystal(f).selectionId, id); assert.deepEqual(f, before);
  }
});
test('mixed wear chooses lowest positive durability then stable identity, ignores broken copies', () => {
  const f = fixture([5, 3, 1, 0, 1]);
  assert.equal(crystal(f).owned, 4); assert.equal(crystal(f).copy.instanceId, 'copy:2');
  const plan = planHeldItemChange({ ...f, pokemonId: 1, requestedItem: id, slot: 'STRATEGIC' });
  assert.equal(plan.pokemon.strategicItemInstanceId, 'copy:2');
  assert.equal(plan.pokemon.equipmentDurability.STRATEGIC.durability, 1);
});
test('other reservations excluded and current worn copy remains current', () => {
  const f = fixture([2, 5]);
  f.collection[1] = { ...f.collection[1], strategicItem: id, strategicItemInstanceId: 'copy:0' };
  assert.equal(crystal(f).owned, 2); assert.equal(crystal(f).available, 1); assert.equal(crystal(f).equipped, 1);
  assert.equal(crystal(f).copy.instanceId, 'copy:1');
  assert.equal(planHeldItemChange({ ...f, pokemonId: 1, requestedItem: { id, instanceId: 'copy:0' }, slot: 'STRATEGIC' }).ok, false);
  f.collection.reverse();
  assert.equal(crystal(f).equippedOnCurrent, true); assert.equal(crystal(f).copy.durability, 2);
  assert.equal(planHeldItemChange({ ...f, pokemonId: 2, requestedItem: id, slot: 'STRATEGIC' }).pokemon.strategicItemInstanceId, 'copy:0');
});
test('equip, replacement, unequip release exact copy with no stock mutation', () => {
  const f = fixture();
  const equip = planHeldItemChange({ ...f, pokemonId: 1, requestedItem: id, slot: 'STRATEGIC' });
  const next = { economy: f.economy, collection: equip.collection };
  assert.equal(crystal(next).available, 2);
  const replace = planHeldItemChange({ ...next, pokemonId: 1, requestedItem: 'fruit-vital', slot: 'STRATEGIC' });
  assert.equal(crystal({ ...next, collection: replace.collection }).available, 3);
  const release = planHeldItemChange({ ...next, pokemonId: 1, requestedItem: null, slot: 'STRATEGIC' });
  assert.equal(crystal({ ...next, collection: release.collection }).available, 3);
  assert.deepEqual(release.economy, f.economy);
});
test('quantity held stays one group and Bag never enters equipment selector', () => {
  const f = fixture();
  assert.equal(groups(f).filter(s => s.item.id === 'fruit-vital').length, 1);
  assert.equal(groups(f).find(s => s.item.id === 'fruit-vital').owned, 8);
  assert.equal(groups(f).some(s => s.item.id === 'vital-potion'), false);
});
test('legacy crystal quantity migrates exactly once across repeated initialization', () => {
  let f = { economy: { inventory: { [id]: 3 } }, collection: [{ id: 1 }] };
  f = migrateDurableEquipment(f.economy, f.collection); const initial = structuredClone(f);
  for (let n = 0; n < 10; n++) f = migrateDurableEquipment(f.economy, f.collection);
  assert.deepEqual(f, initial); assert.equal(crystal(f).owned, 3);
});
test('280 copies across 28 types stay grouped; Grass/Poison relics only, no repeated types', () => {
  const inventory = Object.fromEntries(ITEM_CATALOG.filter(isDurableItem).map(item => [item.id, 10]));
  const f = migrateDurableEquipment({ inventory }, [{ id: 1, types: ['grass', 'poison', 'grass'] }]);
  assert.equal(Object.keys(f.economy.durableItems).length, 280);
  const strategic = groups(f);
  assert.equal(strategic.filter(s => s.instances).length, 10);
  const relics = getEquipmentItemStates({ ...f, pokemon: f.collection[0], slot: 'ELEMENTAL_RELIC' });
  assert.equal(relics.length, 2); assert.deepEqual(relics.map(s => s.item.elementalType), ['grass', 'poison']);
  assert.equal(new Set(strategic.map(s => s.item.id)).size, strategic.length);
});
test('canonical dictionary keys prevent conflicting embedded identity from duplicating selector identity', () => {
  const f = fixture([2, 5]); f.economy.durableItems['copy:1'].instanceId = 'copy:0';
  assert.deepEqual(crystal(f).instances.map(s => s.instanceId), ['copy:0', 'copy:1']);
  assert.equal(planHeldItemChange({ ...f, pokemonId: 1, requestedItem: { id, instanceId: 'copy:1' }, slot: 'STRATEGIC' }).pokemon.strategicItemInstanceId, 'copy:1');
});
