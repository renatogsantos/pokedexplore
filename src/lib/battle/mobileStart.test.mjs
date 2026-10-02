import test from 'node:test';
import assert from 'node:assert/strict';
import { createUuid } from '../runtime/uuid.js';
import { createBattleState, resolveAction, cloneBattleState } from './engine.js';
import { CPU_ROSTER, toBattlePokemon } from './pokemon.js';
import { generateCpuTeam } from './cpu.js';
import { normalizeCapturedPokemon } from '../pokemon/progression.js';
import { getBadgeCpuTeam } from '../badges/cpu.js';
import { buildJourneyCpuTeam } from '../journey/index.js';
import { validatePvpTeam } from './pvpStart.js';
import { migrateDurableEquipment, getEquippedDurableInstances, normalizeDurableInventory } from '../economy/durableEquipment.js';

test('missing randomUUID reproduces old failure; secure fallback works without resetting existing identities', () => {
  const provider = { getRandomValues: bytes => { bytes.fill(42); return bytes; } };
  assert.throws(() => provider.randomUUID(), TypeError);
  assert.match(createUuid(provider), /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.throws(() => createUuid({}), /identifica/);
});
test('without structuredClone the first legal action still resolves and never mutates the input', () => {
  const original = globalThis.structuredClone;
  const team = CPU_ROSTER.slice(0, 3).map(toBattlePokemon);
  const state = createBattleState({ team }, { team }); const before = JSON.stringify(state);
  try { globalThis.structuredClone = undefined;
    const next = resolveAction(state, state.turn, { type:'attack', moveId: state[state.turn].team[0].moves[0].id });
    assert.equal(next.revision, 1); assert.equal(JSON.stringify(state), before);
    const source = { a: undefined, list: [1, null] }; source.self = source;
    const clone = cloneBattleState(source); assert.equal(clone.self, clone); assert.ok('a' in clone);
  } finally { globalThis.structuredClone = original; }
});
test('legacy durable slot without copy cannot dereference undefined in equipment snapshot', () => {
  assert.deepEqual(getEquippedDurableInstances([{ id: 1, strategicItem: 'power-claw' }]), []);
});
test('partial missing wear preserves the physical copy and aggregate without reset or replacement', () => {
  const economy = { inventory: { 'power-claw': 1 }, durableEquipmentVersion: 1, durableItems: { old: { itemId:'power-claw' } } };
  const f = migrateDurableEquipment(economy, [{ id:1, strategicItem:'power-claw', strategicItemInstanceId:'old' }]);
  assert.equal(f.economy.inventory['power-claw'], 1);
  assert.equal(f.economy.durableItems.old.durability, null);
  assert.equal(f.collection[0].strategicItem, null);
  assert.deepEqual(migrateDurableEquipment(f.economy, f.collection), f);
  assert.equal(Object.keys(f.economy.durableItems).length, 1);
});
test('repair removes conflicting bindings and stale references, preserves coins, wear, decks and progress', () => {
  const f = migrateDurableEquipment({ coins: 4500, progress:{ wins:42 }, decks:[{ id:'old', pokemonIds:[1,4,7] }], durableEquipmentVersion:1, inventory:{'power-claw':1}, durableItems:{ old:{ itemId:'power-claw', durability:4 } } }, [{ id:1, level:8, strategicItem:'power-claw', strategicItemInstanceId:'old' }, { id:4, strategicItem:'power-claw', strategicItemInstanceId:'old' }, { id:7, elementalRelic:'perola-abissal', elementalRelicInstanceId:'missing' }]);
  assert.equal(f.collection[0].strategicItemInstanceId, 'old'); assert.equal(f.collection[1].strategicItem, null); assert.equal(f.collection[2].elementalRelic,null);
  assert.equal(f.economy.coins,4500); assert.equal(f.economy.progress.wins,42); assert.equal(f.economy.decks[0].id,'old'); assert.equal(f.economy.durableItems.old.durability,4);
});
const variants = [
  ['current', {}], ['legacy', { heldItemId:'power-claw' }], ['dual', { strategicItem:'power-claw', elementalRelic:'semente-ancestral' }],
  ['missing', { strategicItem:'power-claw', strategicItemInstanceId:'missing' }], ['broken', { strategicItem:'power-claw', strategicItemInstanceId:'broken' }],
  ['empty', { strategicItem:null, elementalRelic:'', equipmentDurability:null }], ['large', {}], ['worn', { strategicItem:'power-claw', strategicItemInstanceId:'worn' }]
];
for (const [label, equipment] of variants) test(`${label}: canonical snapshot initializes CPU easy/medium/hard, PvP, tournament HxH/HxCPU, Badge and Journey`, () => {
  const raw = CPU_ROSTER.slice(0,3).map((p,i) => normalizeCapturedPokemon({ ...p, ...equipment, elementalRelic: equipment.elementalRelic ? ['semente-ancestral','brasa-primordial','perola-abissal'][i] : null, id:p.id }));
  const f = migrateDurableEquipment({ inventory:{ 'power-claw': label === 'large' ? 500 : 3, 'semente-ancestral':1,'brasa-primordial':1,'perola-abissal':1 }, durableEquipmentVersion: ['legacy','dual'].includes(label) ? undefined : 1, durableItems:{ worn:{ itemId:'power-claw', durability:1 }, broken:{ itemId:'power-claw',durability:0 } } },raw);
  const host = f.collection.map(toBattlePokemon);
  assert.equal(validatePvpTeam(JSON.parse(JSON.stringify(host))).valid,true);
  const teams = ['easy','medium','hard'].map(difficulty => generateCpuTeam({ difficulty, playerTeam:host }));
  teams.push(host, host, generateCpuTeam({ difficulty:'hard', playerTeam:host }), getBadgeCpuTeam('grass',1), buildJourneyCpuTeam('route-1',1,CPU_ROSTER));
  for (const opponent of teams) {
    let state = createBattleState({ id:'returning',team:host }, { id:'opponent',team:opponent.map(toBattlePokemon) });
    assert.equal(state.host.team.length,3); assert.ok(state.host.team.every(p => p.hp > 0));
    const next = resolveAction(state,state.turn,{ type:'attack',moveId:state[state.turn].team[0].moves[0].id }); assert.equal(next.revision,1);
    assert.ok(!JSON.stringify(state).includes('durableItems'));
  }
});
test('100/250/500 copies and 130 collection records leave selected snapshots and BattleState size constant', () => {
  const measurements = [];
  for (const count of [3,100,250,500]) {
    const start = performance.now();
    const raw = Array.from({length:130},(_,i) => normalizeCapturedPokemon({...CPU_ROSTER[i%3],id:`owned:${i}`, heldItemId:i<3 ? 'power-claw' : null}));
    const f = migrateDurableEquipment({ inventory:{'power-claw':count} },raw);
    const host = f.collection.slice(0,3).map(toBattlePokemon);
    const state = createBattleState({ id:'player',team:host },{id:'cpu',team:CPU_ROSTER.slice(0,3).map(toBattlePokemon)});
    measurements.push({ count, preparationMs: +(performance.now()-start).toFixed(2), bytes:JSON.stringify(state).length, equippedCopies:getEquippedDurableInstances(host).length });
    assert.equal(host.length,3); assert.equal(getEquippedDurableInstances(host).length,3);
  }
  assert.equal(new Set(measurements.map(m=>m.bytes)).size,1); console.log('[mobile-stress]',JSON.stringify(measurements));
});
test('snapshot strips arbitrary inventory/catalog payloads and full sprite history', () => {
  const raw = { ...CPU_ROSTER[0], inventory:{secret:1}, sprites:{versions:{ old:'large-history' }}, equipmentDurability:{ unrelated:{ inventory:{ secret:1 } } } };
  const snapshot = toBattlePokemon(raw);
  assert.equal(snapshot.inventory,undefined); assert.equal(snapshot.sprites,undefined); assert.deepEqual(snapshot.equipmentDurability,{});
});
