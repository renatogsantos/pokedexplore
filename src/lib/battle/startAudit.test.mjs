import assert from "node:assert/strict";
import test from "node:test";
import { CPU_ROSTER, toBattlePokemon } from "./pokemon.js";
import { generateCpuTeam, decideCpuIntent, getCpuIntentCandidates } from "./cpu.js";
import { createBattleState, resolveAction } from "./engine.js";
import { normalizeCapturedPokemon } from "../pokemon/progression.js";
import { migrateDurableEquipment, resolveDurableEquipment, normalizeDurableInventory } from "../economy/durableEquipment.js";
import { validatePvpTeam } from "./pvpStart.js";
import { getMatchLifecycle, withPreparationDeadline } from "./lifecycle.js";
import { getBadgeCpuTeam } from "../badges/cpu.js";
import { enrichPokemonRarity } from "../pokemon/rarity.js";
import { webStore } from "../../helpers/webStore.js";
import { buildJourneyCpuTeam, JOURNEY_ROUTES } from "../journey/index.js";

const seeded = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const variants = [ {}, { heldItemId: "fruit-vital" }, { strategicItem: "power-claw" }, { elementalRelic: true }, { strategicItem: "power-claw", elementalRelic: true }, { strategicItem: "deleted-item", strategicItemInstanceId: "missing" } ];
const teamFor = variant => CPU_ROSTER.slice(0, 3).map((pokemon, index) => normalizeCapturedPokemon({ ...pokemon, ...variant, ...(variant.elementalRelic ? { elementalRelic: ["semente-ancestral", "brasa-primordial", "perola-abissal"][index] } : {}), level: index + 1 }));
for (const difficulty of ["easy", "medium", "hard"]) test(`${difficulty}: 120 real-roster starts, legacy/dual/stale equipment, manual and Deck references`, () => {
  for (let seed = 1; seed <= 120; seed++) {
    const input = teamFor(variants[seed % variants.length]);
    const migrated = migrateDurableEquipment({ inventory: { "power-claw": 3, "semente-ancestral": 1, "brasa-primordial": 1, "perola-abissal": 1, "fruit-vital": 3 } }, input);
    const local = migrated.collection.map(pokemon => resolveDurableEquipment(pokemon, migrated.economy));
    const selected = seed % 2 ? local : local.map(p => local.find(entry => String(entry.id) === String(p.id)));
    const cpu = generateCpuTeam({ difficulty, playerTeam: selected, random: seeded(seed) });
    assert.equal(cpu.length, 3);
    assert.equal(new Set(cpu.map(p => p.id)).size, 3);
    const hostTeam = selected.map(toBattlePokemon), guestTeam = cpu.map(toBattlePokemon);
    if (seed % variants.length === 4) assert.ok(hostTeam.every(p => p.strategicItemInstanceId && p.elementalRelicInstanceId));
    assert.equal(validatePvpTeam(hostTeam).valid, true);
    assert.equal(validatePvpTeam(guestTeam).valid, true);
    let state = createBattleState({ id: "host", team: hostTeam }, { id: "cpu", team: guestTeam });
    assert.equal(state.revision, 0);
    assert.ok([...state.host.team, ...state.guest.team].every(p => Number.isFinite(p.hp) && p.hp > 0 && p.moves.length));
    for (let turn = 0; turn < 20 && state.status === "playing"; turn++) {
      const actor = state.turn, fighter = state[actor].team[state[actor].active];
      const preferred = actor === "guest" ? decideCpuIntent(state, { difficulty, random: seeded(seed + turn) }) : { type: "attack", moveId: fighter.moves.find(m => !m.special).id };
      const actions = actor === "guest" ? getCpuIntentCandidates(state, preferred) : [preferred, ...state.host.team.map((p, index) => ({ type: "switch", index }))];
      const next = actions.map(action => resolveAction(state, actor, action)).find(candidate => candidate !== state);
      assert.ok(next, `seed ${seed}, turn ${turn} has a legal action`);
      state = next;
    }
  }
});

test("legacy type-only and string-type snapshots survive repeated normalization", () => {
  for (const raw of [{ id: 7, name: "old", type: "water" }, { instanceId: "old-7", name: "old", types: ["water"] }]) {
    const once = toBattlePokemon(normalizeCapturedPokemon(raw));
    const twice = toBattlePokemon(once);
    assert.equal(twice.type, "water"); assert.deepEqual(twice.types, ["water"]); assert.equal(twice.maxHp, once.maxHp);
  }
});
test("all Badge leaders and Journey rounds initialize through the actual engine", () => {
  const local = teamFor({}).map(toBattlePokemon);
  for (const type of ["normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison", "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark", "steel", "fairy"])
    for (let round = 1; round <= 3; round++) assert.equal(createBattleState({ team: local }, { team: getBadgeCpuTeam(type, round).map(toBattlePokemon) }).guest.team.length, 3);
  for (const route of JOURNEY_ROUTES) for (let round = 1; round <= 3; round++) assert.equal(createBattleState({ team: local }, { team: buildJourneyCpuTeam(route.id, round, CPU_ROSTER).map(toBattlePokemon) }).guest.team.length, 3);
});
test("CPU lifecycle ignores multiplayer state and preparation deadline rejects", async () => {
  assert.equal(getMatchLifecycle({ screen: "team", mode: "cpu", connection: "ERROR" }).state, "SELECTING_TEAM");
  await assert.rejects(withPreparationDeadline(() => new Promise(() => {}), 5), /Tente novamente/);
  assert.equal(await withPreparationDeadline(() => 42, 5), 42);
});
test("unavailable rarity does not permanently mark legacy saves NORMAL", async () => {
  const fetchBefore = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new Error("offline"); };
    const legacy = { id: 150, name: "mewtwo" };
    assert.deepEqual(await enrichPokemonRarity(legacy), legacy);
  } finally { globalThis.fetch = fetchBefore; }
});
test("unresponsive rarity requests abort instead of leaving preparation pending", async t => {
  const fetchBefore = globalThis.fetch;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    globalThis.fetch = (_, { signal }) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
    const legacy = { id: 150, name: "mewtwo" };
    const result = enrichPokemonRarity(legacy);
    t.mock.timers.tick(5001);
    assert.deepEqual(await result, legacy);
  } finally { globalThis.fetch = fetchBefore; }
});
test("battle storage reads propagate unavailable IndexedDB instead of returning an empty team/inventory", async () => {
  const consoleBefore = console.error;
  try {
    console.error = () => {};
    await assert.rejects(webStore.getData("Pokedex", { enrichRarity: false, strict: true }), /IndexedDB/);
    await assert.rejects(webStore.getEconomy({ strict: true }), /IndexedDB/);
    await assert.rejects(webStore.getLocalPlayerProfile({ strict: true }), /IndexedDB/);
  } finally { console.error = consoleBefore; }
});
test("partially saved durable entries cannot abort legacy equipment migration", () => {
  const repaired = normalizeDurableInventory({ inventory: { "power-claw": 1 }, durableItems: { broken: null, older: "power-claw" } });
  assert.equal(Object.values(repaired.durableItems).length, 1);
  assert.equal(Object.values(repaired.durableItems)[0].itemId, "power-claw");
  const migrated = migrateDurableEquipment(repaired, teamFor({}));
  assert.equal(migrated.collection.length, 3);
});
