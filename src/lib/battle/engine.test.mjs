import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const catalogSource = await readFile(
  new URL("../items/catalog.js", import.meta.url),
  "utf8",
);
const catalog = await import(
  `data:text/javascript;base64,${Buffer.from(catalogSource).toString("base64")}`
);
globalThis.__itemCatalog = catalog;
const statusesSource = await readFile(
  new URL("./statuses.js", import.meta.url),
  "utf8",
);
globalThis.__battleStatuses = await import(
  `data:text/javascript;base64,${Buffer.from(statusesSource).toString("base64")}`
);
const abilitiesSource = await readFile(
  new URL("./abilities.js", import.meta.url),
  "utf8",
);
globalThis.__battleAbilities = await import(
  `data:text/javascript;base64,${Buffer.from(abilitiesSource).toString("base64")}`,
);
const engineSource = (
  await readFile(new URL("./engine.js", import.meta.url), "utf8")
)
  .replace(
    /import\s*\{[\s\S]*?BAG_ITEM_CATALOG[\s\S]*?\}\s*from\s*"@\/lib\/items\/catalog";/,
    "const { BAG_ITEM_CATALOG, getItemDefinition, migrateLegacyItemId } = globalThis.__itemCatalog;",
  )
  .replace(
    /import\s*\{[\s\S]*?isSupportedStatus[\s\S]*?\}\s*from\s*"@\/lib\/battle\/statuses";/,
    "const { isSupportedStatus, normalizeStatusEffect } = globalThis.__battleStatuses;",
  )
  .replace(
    /import\s*\{[\s\S]*?normalizeAbilityId,[\s\S]*?\}\s*from\s*"@\/lib\/battle\/abilities";/,
    "const { getContactAbilityRule, getContactAbilityPreview, getContactRecoilRule, getDamageModifiers, getDamageAbilityRule, getEndTurnAbilityRule, getEnterAbilityRule, getStatusPreventionRule, getSupportedAbility: getCatalogAbility, normalizeAbilityId } = globalThis.__battleAbilities;",
  );
const {
  MAX_HEALS_PER_POKEMON,
  MAX_SPECIAL_ATTACK_USES,
  calculateDamage,
  getDamagePreview,
  analyzeMoveDecision,
  createBattleState,
  getBattleMoves,
  getTypeEffectiveness,
  getHpRatio,
  getBagItemUseBlockReason,
  getPotionHealAmount,
  resolveAction,
  resolvePostDamageHeldItem,
} = await import(
  `data:text/javascript;base64,${Buffer.from(engineSource).toString("base64")}`
);
globalThis.__battleEngineForCpuTest = { calculateDamage, analyzeMoveDecision, getHpRatio, getBagItemUseBlockReason, getPotionHealAmount, getTypeEffectiveness };
const cpuSource = (await readFile(new URL("./cpu.js", import.meta.url), "utf8"))
  .replace(/import\s*\{[\s\S]*?\}\s*from "@\/lib\/battle\/engine";/, "const { calculateDamage, analyzeMoveDecision, getHpRatio, getBagItemUseBlockReason, getPotionHealAmount, getTypeEffectiveness } = globalThis.__battleEngineForCpuTest;")
  .replace('import { CPU_ROSTER } from "@/lib/battle/pokemon";', "const CPU_ROSTER = [];")
  .replace('import { BAG_ITEM_CATALOG, ITEM_CATALOG } from "@/lib/items/catalog";', "const { BAG_ITEM_CATALOG, ITEM_CATALOG } = globalThis.__itemCatalog;");
const { decideCpuIntent, getCpuIntentCandidates } = await import(`data:text/javascript;base64,${Buffer.from(cpuSource).toString("base64")}`);

const pokemon = (
  id,
  heldItem = null,
  hp = 100,
  level = 5,
  type = "normal",
) => ({
  id,
  name: `P${id}`,
  level,
  type,
  types: [type],
  heldItem,
  maxHp: 100,
  hp,
  stats: {
    attack: 50,
    defense: 50,
    specialAttack: 50,
    specialDefense: 50,
    speed: 50,
  },
  moveset: [
    {
      id: "hit",
      name: "Hit",
      type,
      power: 40,
      accuracy: 100,
      damageClass: "physical",
      special: false,
    },
    {
      id: "special",
      name: "Special",
      type,
      power: 70,
      accuracy: 100,
      damageClass: "special",
      special: true,
    },
  ],
});
const inventory = {
  "vital-potion": 4,
  "supreme-potion": 2,
  "purifying-elixir": 2,
  "instant-barrier": 2,
  stimulant: 2,
  "recharge-crystal": 2,
};
const makeState = (hostItem = null, guestItem = null) =>
  createBattleState(
    {
      id: "h",
      name: "Host",
      inventory,
      team: [pokemon(1, hostItem), pokemon(2), pokemon(3)],
    },
    {
      id: "g",
      name: "Guest",
      inventory,
      team: [pokemon(4, guestItem), pokemon(5), pokemon(6)],
    },
    "host",
  );

test("catalog exposes the complete expanded collection", () => {
  assert.equal(catalog.ITEM_CATALOG.length, 58);
  assert.equal(catalog.HELD_ITEM_CATALOG.length, 43);
  assert.equal(catalog.BAG_ITEM_CATALOG.length, 15);
  assert.equal(new Set(catalog.ITEM_CATALOG.map((item) => item.id)).size, 58);
  assert.equal(
    catalog.getItemDefinition("vampiric-crystal").rules.damageHealPercent,
    0.1,
  );
});

test("only the active living Pokémon's own moves can advance a turn", () => {
  const state = makeState();
  const unknownMove = state.host.team[0].moves.find((move) => move.id !== "hit").id;
  state.host.team[0].moves = state.host.team[0].moves.filter((move) => move.id === "hit");
  assert.strictEqual(resolveAction(state, "host", { type: "attack", moveId: unknownMove }), state);
  assert.strictEqual(resolveAction(state, "host", { type: "attack", moveId: "strike" }), state);
  state.host.team[0].hp = 0;
  assert.strictEqual(resolveAction(state, "host", { type: "attack", moveId: "hit" }), state);
});

test("an Elemental Mine resolves survival or final faint before the next turn", () => {
  const surviving = makeState("survival-amulet");
  surviving.host.team[1].heldItem = "survival-amulet";
  surviving.host.temporarySideEffects = { elementalMine: { damagePercent: 1 } };
  const saved = resolveAction(surviving, "host", { type: "switch", index: 1, actionId: "mine-survive" });
  assert.equal(saved.host.team[1].hp, 1);
  assert.equal(saved.host.team[1].heldItem, null);
  assert.equal(saved.effect.faintEvents?.length || 0, 0);

  const lethal = makeState();
  lethal.host.temporarySideEffects = { elementalMine: { damagePercent: 1 } };
  const switched = resolveAction(lethal, "host", { type: "switch", index: 1, actionId: "mine-faint" });
  assert.equal(switched.host.team[1].hp, 0);
  assert.ok(switched.host.team[switched.host.active].hp > 0);
  assert.equal(switched.effect.faintEvents?.length, 1);
  assert.equal(switched.turn, "guest");
});

test("90 complete CPU matches across Easy, Medium and Hard never stall or violate active-HP invariants", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (let seed = 1; seed <= 30; seed += 1) {
      let state = makeState();
      let randomSeed = seed;
      const random = () => { randomSeed = (randomSeed * 48271) % 2147483647; return randomSeed / 2147483647; };
      for (let turn = 0; turn < 500 && state.status === "playing"; turn += 1) {
        const actor = state.turn;
        const active = state[actor].team[state[actor].active];
        assert.ok(active?.hp > 0, `${difficulty}/${seed}/${turn}: fainted active`);
        const preferred = actor === "guest"
          ? decideCpuIntent(state, { difficulty, random })
          : { type: "attack", moveId: active.moves.find((move) => !move.special)?.id };
        const candidates = actor === "guest" ? getCpuIntentCandidates(state, preferred) : [preferred];
        const next = candidates.map((intent) => resolveAction(state, actor, intent)).find((result) => result !== state);
        assert.ok(next, `${difficulty}/${seed}/${turn}: no valid action`);
        assert.equal(next.revision, state.revision + 1);
        for (const side of ["host", "guest"])
          for (const fighter of next[side].team)
            assert.ok(fighter.hp >= 0 && fighter.hp <= fighter.maxHp, `${difficulty}/${seed}/${turn}: invalid HP`);
        state = next;
      }
      assert.equal(state.status, "finished", `${difficulty}/${seed}: unfinished after 500 turns`);
      assert.ok(["host", "guest"].includes(state.winner));
      assert.strictEqual(resolveAction(state, state.turn, { type: "attack", moveId: "hit" }), state);
    }
  }
});

test("Vampiric Crystal restores 10% of the direct damage dealt", () => {
  const state = makeState("vampiric-crystal");
  state.host.team[0].hp = 20;
  const next = resolveAction(state, "host", {
    type: "attack",
    moveId: "hit",
  });
  const healEvent = next.effect.itemEvents.find(
    (event) => event.itemId === "vampiric-crystal",
  );
  assert.equal(healEvent.effect.amount, Math.ceil(next.effect.damage * 0.1));
  assert.equal(next.host.team[0].hp, 20 + healEvent.effect.amount);
});

test("legacy ids migrate once to original stable ids", () => {
  assert.deepEqual(
    catalog.migrateItemInventory({
      oran: 2,
      sitrus: 1,
      potion: 3,
      "full-heal": 1,
      "fire-boost": 1,
    }),
    {
      "fruit-vital": 2,
      "healing-core": 1,
      "vital-potion": 3,
      "purifying-elixir": 1,
      "elemental-core": 1,
    },
  );
});

test("Bag healing consumes inventory and turn only on a valid use", () => {
  const state = makeState();
  state.host.team[0].hp = 20;
  const next = resolveAction(state, "host", {
    type: "item",
    itemId: "vital-potion",
    targetPokemonId: 1,
  });
  assert.equal(next.host.team[0].hp, 60);
  assert.equal(next.host.team[0].healsUsed, 1);
  assert.equal(next.host.bag["vital-potion"], 3);
  assert.equal(next.turn, "guest");
  const full = makeState();
  assert.strictEqual(
    resolveAction(full, "host", {
      type: "item",
      itemId: "vital-potion",
      targetPokemonId: 1,
    }),
    full,
  );
});

test("manual healing remains capped at three per Pokemon while automatic healing is separate", () => {
  let state = makeState();
  for (let index = 0; index < MAX_HEALS_PER_POKEMON; index += 1) {
    state.turn = "host";
    state.host.team[0].hp = 20;
    state = resolveAction(state, "host", {
      type: "item",
      itemId: "vital-potion",
      targetPokemonId: 1,
    });
  }
  state.turn = "host";
  state.host.team[0].hp = 20;
  assert.strictEqual(
    resolveAction(state, "host", {
      type: "item",
      itemId: "supreme-potion",
      targetPokemonId: 1,
    }),
    state,
  );
  const holder = {
    id: 8,
    hp: 45,
    maxHp: 100,
    heldItem: "fruit-vital",
    temporaryEffects: {},
  };
  assert.equal(resolvePostDamageHeldItem(holder).effect.amount, 20);
  assert.equal(holder.hp, 65);
});

test("status cure, barrier, stimulant and recharge enforce contextual validity", () => {
  const cure = makeState();
  cure.host.team[0].status = { id: "poison" };
  const cured = resolveAction(cure, "host", {
    type: "item",
    itemId: "purifying-elixir",
    targetPokemonId: 1,
  });
  assert.equal(cured.host.team[0].status, null);
  const noStatus = makeState();
  assert.strictEqual(
    resolveAction(noStatus, "host", {
      type: "item",
      itemId: "purifying-elixir",
      targetPokemonId: 1,
    }),
    noStatus,
  );
  const barrier = resolveAction(makeState(), "host", {
    type: "item",
    itemId: "instant-barrier",
    targetPokemonId: 1,
  });
  assert.equal(barrier.host.team[0].temporaryEffects.barrier, true);
  const stimulant = resolveAction(makeState(), "host", {
    type: "item",
    itemId: "stimulant",
    targetPokemonId: 1,
  });
  assert.equal(stimulant.host.team[0].temporaryEffects.stimulant, true);
  const recharge = makeState();
  recharge.host.team[0].specialAttackUsesRemaining = 1;
  const recharged = resolveAction(recharge, "host", {
    type: "item",
    itemId: "recharge-crystal",
    targetPokemonId: 1,
  });
  assert.equal(recharged.host.team[0].specialAttackUsesRemaining, 2);
  recharged.turn = "host";
  assert.strictEqual(
    resolveAction(recharged, "host", {
      type: "item",
      itemId: "recharge-crystal",
      targetPokemonId: 1,
    }),
    recharged,
  );
});

test("Fruto Vital and Nucleo de Cura trigger only after qualifying received damage", () => {
  const fruit = {
    id: 1,
    hp: 51,
    maxHp: 100,
    heldItem: "fruit-vital",
    temporaryEffects: {},
  };
  assert.equal(resolvePostDamageHeldItem(fruit), null);
  fruit.hp = 50;
  assert.equal(resolvePostDamageHeldItem(fruit).effect.amount, 20);
  assert.equal(fruit.heldItem, null);
  const core = {
    id: 2,
    hp: 26,
    maxHp: 100,
    heldItem: "healing-core",
    temporaryEffects: {},
  };
  assert.equal(resolvePostDamageHeldItem(core), null);
  core.hp = 25;
  assert.equal(resolvePostDamageHeldItem(core).effect.amount, 50);
});

test("every expanded Bag effect changes canonical battle state before it is consumed", () => {
  const withBag = (itemId) => { const state = makeState(); state.host.bag[itemId] = 1; return state; };
  let state = withBag("fragmento-da-ruina");
  state = resolveAction(state, "host", { type: "item", itemId: "fragmento-da-ruina", targetPokemonId: 4 });
  assert.equal(state.guest.team[0].temporaryEffects.ruin.ticks, 3);
  state = withBag("bomba-temporal");
  state = resolveAction(state, "host", { type: "item", itemId: "bomba-temporal", targetPokemonId: 4 });
  assert.equal(state.guest.team[0].temporaryEffects.timeBomb.ticks, 3);
  state = withBag("marca-do-cacador");
  state = resolveAction(state, "host", { type: "item", itemId: "marca-do-cacador", targetPokemonId: 4 });
  assert.equal(state.guest.team[0].temporaryEffects.hunterMark.multiplier, 1.1);
  state = withBag("escudo-refletor");
  state = resolveAction(state, "host", { type: "item", itemId: "escudo-refletor", targetPokemonId: 1 });
  assert.equal(state.host.team[0].temporaryEffects.reflectShield.reflectPercent, 0.3);
  state = withBag("parasita-de-energia"); state.host.team[0].momentum = 0; state.guest.team[0].momentum = 2;
  state = resolveAction(state, "host", { type: "item", itemId: "parasita-de-energia", targetPokemonId: 4 });
  assert.deepEqual([state.host.team[0].momentum, state.guest.team[0].momentum], [1, 1]);
  state = withBag("selo-do-silencio");
  state = resolveAction(state, "host", { type: "item", itemId: "selo-do-silencio", targetPokemonId: 4 });
  assert.equal(state.guest.team[0].temporaryEffects.silence.ticks, 1);
  state = resolveAction(state, "guest", { type: "attack", moveId: state.guest.team[0].moves.find((move) => move.special).id });
  assert.equal(state.turn, "host");
  assert.equal(state.guest.team[0].temporaryEffects.silence, undefined);
  assert.equal(state.effect.itemEvents[0].effect.type, "special_blocked");
  state = withBag("ancora-dimensional");
  state = resolveAction(state, "host", { type: "item", itemId: "ancora-dimensional", targetPokemonId: 4 });
  assert.equal(state.guest.team[0].temporaryEffects.anchor.ticks, 2);
  state = withBag("mina-elemental");
  state = resolveAction(state, "host", { type: "item", itemId: "mina-elemental", targetPokemonId: 4 });
  assert.equal(state.guest.temporarySideEffects.elementalMine.damagePercent, 0.1);
  state = withBag("nucleo-de-sobrecarga");
  state = resolveAction(state, "host", { type: "item", itemId: "nucleo-de-sobrecarga", targetPokemonId: 1 });
  assert.equal(state.host.team[0].temporaryEffects.overload.receivedMultiplier, 1.15);
});

test("all eighteen relics have a canonical base damage path and special relic state is battle-local", () => {
  const relics = catalog.ELEMENTAL_RELIC_CATALOG;
  assert.equal(relics.length, 18);
  relics.forEach((relic) => {
    const attacker = { ...pokemon(1, null, 100, 5, relic.elementalType), elementalRelic: relic.id };
    const defender = pokemon(2, null, 100, 5, "normal");
    const result = calculateDamage({ attacker, defender, move: { ...attacker.moveset[0], type: relic.elementalType }, variance: 1 });
    assert.equal(result.itemTriggers.some((trigger) => trigger.itemId === relic.id), true, relic.id);
  });
});

test("private PvP Bags do not share stock yet accept a legal guest item intent", () => {
  const state = createBattleState(
    { id: "h", name: "Host", privateBag: true, inventory: {}, team: [pokemon(1), pokemon(2), pokemon(3)] },
    { id: "g", name: "Guest", privateBag: true, inventory: {}, team: [pokemon(4, null, 20), pokemon(5), pokemon(6)] },
    "guest",
  );
  const next = resolveAction(state, "guest", { type: "item", itemId: "vital-potion", targetPokemonId: 4, actionId: "guest-potion" });
  assert.equal(next.guest.team[0].hp, 60);
  assert.equal(next.guest.privateBag, true);
  assert.equal(next.guest.bag["vital-potion"], 0);
  assert.equal(next.effect.remaining, null);
  assert.equal(next.effect.eventId, "guest-potion");
});

test("private Bags preserve independent per-battle limits for either PvP side", () => {
  for (const actor of ["host", "guest"]) {
    const state = createBattleState(
      { id: "challenger", name: "Challenger", privateBag: true, inventory: {}, team: [pokemon(1, null, 20), pokemon(2), pokemon(3)] },
      { id: "defender", name: "Defender", privateBag: true, inventory: {}, team: [pokemon(4, null, 20), pokemon(5), pokemon(6)] },
      actor,
    );
    const targetPokemonId = actor === "host" ? 1 : 4;
    const next = resolveAction(state, actor, { type: "item", itemId: "vital-potion", targetPokemonId, actionId: `${actor}-badge-item` });
    assert.equal(next.effect.actor, actor);
    assert.equal(next[actor].team[0].bagUsage.total, 1);
    assert.equal(next[actor === "host" ? "guest" : "host"].team[0].bagUsage.total, 0);
  }
});

test("Bag item limits and the five-use budget are authoritative per Pokemon", () => {
  let state = makeState();
  state.host.team[0].hp = 10;
  for (let index = 0; index < 3; index += 1) {
    state.turn = "host";
    state.host.team[0].hp = 10;
    state = resolveAction(state, "host", { type: "potion", targetPokemonId: 1, actionId: `vital-${index}` });
  }
  state.turn = "host";
  state.host.team[0].hp = 10;
  assert.strictEqual(resolveAction(state, "host", { type: "potion", targetPokemonId: 1 }), state);
  assert.deepEqual(state.host.team[0].bagUsage, { total: 3, byItem: { "vital-potion": 3 } });

  state.host.team[0].status = { id: "poison" };
  state.turn = "host";
  state = resolveAction(state, "host", { type: "item", itemId: "purifying-elixir", targetPokemonId: 1 });
  state.host.team[0].temporaryEffects.barrier = false;
  state.turn = "host";
  state = resolveAction(state, "host", { type: "item", itemId: "instant-barrier", targetPokemonId: 1 });
  assert.equal(state.host.team[0].bagUsage.total, 5);
  state.host.team[0].specialAttackUsesRemaining = 1;
  state.turn = "host";
  assert.strictEqual(resolveAction(state, "host", { type: "item", itemId: "recharge-crystal", targetPokemonId: 1 }), state);
  assert.equal(state.host.bag["recharge-crystal"], 2);
  assert.equal(state.host.team[0].bagUsage.byItem["recharge-crystal"] || 0, 0);
});

test("Bag limits survive switches, reset in a new battle, and do not include Held consumption", () => {
  const state = makeState("healing-core");
  state.host.team[0].bagUsage = { total: 4, byItem: { stimulant: 2, "vital-potion": 2 } };
  state.host.team[1].bagUsage = { total: 0, byItem: {} };
  state.turn = "host";
  const switched = resolveAction(state, "host", { type: "switch", index: 1 });
  assert.deepEqual(switched.host.team[0].bagUsage, { total: 4, byItem: { stimulant: 2, "vital-potion": 2 } });
  assert.deepEqual(switched.host.team[1].bagUsage, { total: 0, byItem: {} });
  const fresh = makeState("healing-core");
  assert.deepEqual(fresh.host.team[0].bagUsage, { total: 0, byItem: {} });
  fresh.host.team[0].hp = 25;
  fresh.turn = "guest";
  const heldTriggered = resolveAction(fresh, "guest", { type: "attack", moveId: "hit" });
  assert.equal(heldTriggered.host.team[0].bagUsage.total, 0);
});

test("V2 catalog uses one resolver for damage, status, contact and lifecycle rules", () => {
  const abilities = globalThis.__battleAbilities;
  const v2 = ["sturdy", "thick-fat", "multiscale", "filter", "solid-rock", "adaptability", "technician", "iron-fist", "strong-jaw", "rough-skin", "iron-barbs", "immunity", "limber", "insomnia", "vital-spirit", "own-tempo", "regenerator", "moxie", "defiant", "competitive", "sap-sipper", "lightning-rod", "storm-drain"];
  for (const id of v2) assert.equal(Boolean(abilities.getSupportedAbility(id)), true, id);

  const attacker = { type: "fire", types: ["fire"], abilityId: "technician" };
  const defender = { type: "grass", types: ["grass"], abilityId: "thick-fat" };
  const modifiers = abilities.getDamageModifiers({ attacker, defender, move: { power: 60, traits: [] }, attackType: "fire", effectiveness: 1.3, attackerHpRatio: 1, defenderHpRatio: 1 });
  assert.equal(modifiers.outgoing[0].multiplier, 1.5);
  assert.equal(modifiers.incoming[0].multiplier, 0.5);
  assert.equal(abilities.getDamageModifiers({ attacker: { ...attacker, abilityId: "iron-fist" }, defender, move: { power: 75, traits: ["PUNCH"] }, attackType: "fire", effectiveness: 1, attackerHpRatio: 1, defenderHpRatio: 1 }).outgoing[0].multiplier, 1.2);
  assert.equal(abilities.getDamageModifiers({ attacker: { ...attacker, abilityId: "strong-jaw" }, defender, move: { power: 75, traits: ["BITE"] }, attackType: "fire", effectiveness: 1, attackerHpRatio: 1, defenderHpRatio: 1 }).outgoing[0].multiplier, 1.5);

  assert.equal(abilities.getStatusPreventionRule({ abilityId: "immunity" }, "poison").id, "immunity");
  assert.equal(abilities.getStatusPreventionRule({ abilityId: "limber" }, "paralysis").id, "limber");
  assert.equal(abilities.getStatusPreventionRule({ abilityId: "insomnia" }, "sleep").id, "insomnia");
  assert.equal(abilities.getContactRecoilRule({ abilityId: "rough-skin" }).ratio, 1 / 8);
  assert.equal(abilities.getDamageAbilityRule({ attacker, defender: { abilityId: "storm-drain" }, attackType: "water", hpRatio: 1 }).kind, "immunity");
});

test("item presentation keeps usage, persistence and trigger separate", () => {
  const core = catalog.getItemUsagePresentation("healing-core");
  const potion = catalog.getItemUsagePresentation("vital-potion");
  const elemental = catalog.getItemUsagePresentation("elemental-core");
  assert.deepEqual(
    { usage: core.usageLabel, persistence: core.persistenceLabel },
    { usage: "EQUIPÁVEL", persistence: "CONSUMÍVEL" },
  );
  assert.match(core.triggerLabel, /25%/);
  assert.deepEqual(
    { usage: potion.usageLabel, persistence: potion.persistenceLabel },
    { usage: "MOCHILA", persistence: "CONSUMÍVEL" },
  );
  assert.equal(elemental.persistenceLabel, "DURÁVEL");
});

test("a triggered Healing Core emits one durable ITEM_CONSUMED event", () => {
  const state = makeState("healing-core");
  state.host.team[0].hp = 27;
  state.turn = "guest";
  const next = resolveAction(state, "guest", { type: "attack", moveId: "hit", actionId: "cpu-core" });
  const consumed = next.effect.itemEvents.find((event) => event.itemId === "healing-core");
  assert.equal(next.host.team[0].heldItem, null);
  assert.deepEqual(
    { type: consumed.type, consumed: consumed.consumed, owner: consumed.owner, pokemonId: consumed.pokemonId, eventId: consumed.eventId },
    { type: "ITEM_CONSUMED", consumed: true, owner: "host", pokemonId: 1, eventId: "cpu-core" },
  );
});

test("survival items intercept lethal damage authoritatively", () => {
  const amulet = makeState(null, "survival-amulet");
  amulet.guest.team[0].hp = 1;
  const survived = resolveAction(amulet, "host", {
    type: "attack",
    moveId: "hit",
    actionId: "lethal-a",
  });
  assert.equal(survived.guest.team[0].hp, 1);
  assert.equal(survived.guest.team[0].heldItem, null);
  const phoenix = makeState(null, "phoenix-heart");
  phoenix.guest.team[0].hp = 1;
  const revived = resolveAction(phoenix, "host", {
    type: "attack",
    moveId: "hit",
    actionId: "lethal-p",
  });
  const phoenixRecovery = Math.ceil(revived.guest.team[0].maxHp * catalog.getItemDefinition("phoenix-heart").rules.healPercent);
  assert.equal(revived.guest.team[0].hp, phoenixRecovery);
  assert.equal(revived.guest.team[0].heldItem, null);
  assert.equal(revived.guest.team[0].temporaryEffects.phoenix, true);
});

test("consumable damage modifiers consume only on a successful damaging move", () => {
  const state = makeState("impact-crystal");
  const next = resolveAction(state, "host", {
    type: "attack",
    moveId: "hit",
    actionId: "impact",
  });
  assert.equal(next.host.team[0].heldItem, null);
  assert.equal(
    next.effect.itemEvents.some(
      (event) =>
        event.itemId === "impact-crystal" &&
        event.consumed &&
        event.owner === "host" &&
        event.pokemonId === next.host.team[0].id,
    ),
    true,
  );
  const miss = makeState("impact-crystal");
  miss.host.team[0].moves.find((move) => move.id === "hit").accuracy = 0;
  const failed = resolveAction(miss, "host", { type: "attack", moveId: "hit" });
  assert.equal(failed.host.team[0].heldItem, "impact-crystal");
});

test("passive damage items apply exactly once", () => {
  const base = calculateDamage({
    attacker: pokemon(1),
    defender: pokemon(2),
    move: pokemon(1).moveset[0],
    variance: 1,
  });
  const claw = calculateDamage({
    attacker: pokemon(1, "power-claw"),
    defender: pokemon(2),
    move: pokemon(1).moveset[0],
    variance: 1,
  });
  assert.ok(claw.damage > base.damage);
  const core = calculateDamage({
    attacker: pokemon(1, "elemental-core", 100, 5, "fire"),
    defender: pokemon(2),
    move: { ...pokemon(1).moveset[0], type: "fire" },
    variance: 1,
  });
  assert.ok(core.damage > base.damage);
  const unstable = calculateDamage({
    attacker: pokemon(1, "unstable-charge", 40),
    defender: pokemon(2),
    move: pokemon(1).moveset[0],
    variance: 1,
  });
  assert.ok(unstable.damage > base.damage);
  const eyeAttacker = pokemon(1, "strategist-eye", 100, 5, "water");
  const fireDefender = pokemon(2, null, 100, 5, "fire");
  const waterMove = { ...eyeAttacker.moveset[0], type: "water" };
  const eye = calculateDamage({
    attacker: eyeAttacker,
    defender: fireDefender,
    move: waterMove,
    variance: 1,
  });
  const waterWithoutEye = calculateDamage({
    attacker: pokemon(1, null, 100, 5, "water"),
    defender: fireDefender,
    move: waterMove,
    variance: 1,
  });
  assert.ok(eye.damage > waterWithoutEye.damage);
  const crown = calculateDamage({
    attacker: pokemon(1, "challenger-crown", 100, 5),
    defender: pokemon(2, null, 100, 10),
    move: pokemon(1).moveset[0],
    variance: 1,
  });
  const evenCrown = calculateDamage({
    attacker: pokemon(1, "challenger-crown", 100, 5),
    defender: pokemon(2, null, 100, 5),
    move: pokemon(1).moveset[0],
    variance: 1,
  });
  assert.ok(crown.damage > evenCrown.damage);
});

test("switch effects distinguish voluntary switch from initial spawn", () => {
  const returning = makeState("return-symbol");
  returning.host.team[0].hp = 50;
  const switched = resolveAction(returning, "host", {
    type: "switch",
    index: 1,
    actionId: "switch",
  });
  assert.equal(switched.host.team[0].hp, 60);
  assert.equal(switched.host.team[0].heldItem, null);
  assert.equal(switched.effect.itemEvents[0].owner, "host");
  assert.equal(switched.effect.itemEvents[0].pokemonId, switched.host.team[0].id);
  const boots = makeState();
  boots.host.team[1].heldItem = "impulse-boots";
  const entered = resolveAction(boots, "host", { type: "switch", index: 1 });
  assert.equal(entered.host.team[1].temporaryEffects.impulse, true);
});

test("special uses stay at two and Special Fragment is selective", () => {
  const state = makeState("special-fragment");
  const regular = resolveAction(state, "host", {
    type: "attack",
    moveId: "hit",
  });
  assert.equal(regular.host.team[0].heldItem, "special-fragment");
  regular.turn = "host";
  const specialMove = regular.host.team[0].moves.find((move) => move.special);
  const special = resolveAction(regular, "host", {
    type: "attack",
    moveId: specialMove.id,
  });
  assert.equal(special.host.team[0].heldItem, null);
  assert.equal(
    special.host.team[0].specialAttackUsesRemaining,
    MAX_SPECIAL_ATTACK_USES - 1,
  );
});

test("invalid actions preserve the original state reference", () => {
  const state = makeState();
  assert.strictEqual(
    resolveAction(state, "guest", {
      type: "item",
      itemId: "vital-potion",
      targetPokemonId: 4,
    }),
    state,
  );
  assert.strictEqual(
    resolveAction(state, "host", {
      type: "item",
      itemId: "instant-barrier",
      targetPokemonId: 2,
    }),
    state,
  );
});

test("status metadata is normalized per move and never inferred from elemental type", () => {
  const electric = getBattleMoves({ type: "electric" });
  const poison = getBattleMoves({ type: "poison" });
  assert.deepEqual(
    electric.find((entry) => entry.name === "Spark").statusEffect,
    { id: "paralysis", chance: 0.3 },
  );
  assert.deepEqual(
    poison.find((entry) => entry.name === "Acid").statusEffect,
    null,
  );
  assert.equal(
    getBattleMoves({ type: "grass" }).every((entry) => !entry.statusEffect),
    true,
  );
  assert.equal(
    getBattleMoves({ type: "ice" }).every((entry) => !entry.statusEffect),
    true,
  );
});

test("successful status application keeps authoritative cause and source metadata", () => {
  const state = makeState();
  const hit = state.host.team[0].moves.find((entry) => entry.id === "hit");
  hit.statusEffect = { id: "paralysis", chance: 1 };
  const next = resolveAction(state, "host", {
    type: "attack",
    moveId: "hit",
    actionId: "status-source",
  });
  assert.equal(next.guest.team[0].status.sourceMoveName, "Hit");
  assert.equal(next.guest.team[0].status.sourcePokemonId, 1);
  assert.deepEqual(
    next.effect.statusEvents.find((event) => event.type === "STATUS_APPLIED"),
    {
      type: "STATUS_APPLIED",
      status: "paralysis",
      successful: true,
      eventId: "status-source",
      targetPokemonId: 4,
      targetPokemonName: "P4",
      targetRole: "guest",
      sourcePokemonId: 1,
      sourcePokemonName: "P1",
      sourceRole: "host",
      sourceKind: "move",
      moveId: "hit",
      moveName: "Hit",
      itemId: null,
      abilityId: null,
      chance: 1,
      appliedTurn: 1,
    },
  );
});

test("paralysis reports a prevented action without launching an attack", () => {
  const state = makeState();
  state.host.team[0].status = { id: "paralysis" };
  state.rng = 0;
  const next = resolveAction(state, "host", { type: "attack", moveId: "hit" });
  assert.equal(next.effect.kind, "status");
  assert.equal(next.effect.statusEvent.type, "STATUS_TRIGGERED");
  assert.equal(next.effect.statusEvent.preventedAction, true);
  assert.equal(next.guest.team[0].hp, state.guest.team[0].hp);
});

test("sleep reports blocked turns and a visible expiration event", () => {
  let state = makeState();
  state.host.team[0].status = {
    id: "sleep",
    turns: 2,
    sourceMoveName: "Sleep Powder",
  };
  state = resolveAction(state, "host", { type: "attack", moveId: "hit" });
  assert.equal(state.host.team[0].status.turns, 1);
  assert.equal(state.effect.statusEvents[0].type, "STATUS_TRIGGERED");
  state.turn = "host";
  state = resolveAction(state, "host", { type: "attack", moveId: "hit" });
  assert.equal(state.host.team[0].status, null);
  assert.equal(
    state.effect.statusEvents.some((event) => event.type === "STATUS_EXPIRED"),
    true,
  );
});

test("periodic status damage is applied once and exposed as a structured event", () => {
  const state = makeState();
  state.host.team[0].status = { id: "burn", sourceMoveName: "Ember" };
  const next = resolveAction(state, "host", { type: "attack", moveId: "hit" });
  assert.equal(next.host.team[0].hp, 92);
  const event = next.effect.statusEvents.find(
    (entry) => entry.type === "STATUS_DAMAGE",
  );
  assert.equal(event.status, "burn");
  assert.equal(event.damage, 8);
  assert.equal(event.targetPokemonId, 1);
});

test("manual and automatic cures emit one traceable cure event", () => {
  const manual = makeState();
  manual.host.team[0].status = { id: "poison" };
  const cured = resolveAction(manual, "host", {
    type: "item",
    itemId: "purifying-elixir",
    targetPokemonId: 1,
  });
  assert.equal(
    cured.effect.statusEvents.filter((event) => event.type === "STATUS_CURED")
      .length,
    1,
  );
  const automatic = makeState(null, "purifier");
  automatic.host.team[0].moves.find(
    (entry) => entry.id === "hit",
  ).statusEffect = { id: "burn", chance: 1 };
  const purified = resolveAction(automatic, "host", {
    type: "attack",
    moveId: "hit",
    actionId: "purifier",
  });
  assert.equal(purified.guest.team[0].status, null);
  assert.equal(purified.guest.team[0].heldItem, null);
  assert.equal(
    purified.effect.statusEvents.filter(
      (event) => event.type === "STATUS_CURED",
    ).length,
    1,
  );
});

test("Phoenix Heart resolves before a last Pokemon can lose the battle", () => {
  const state = makeState(null, "phoenix-heart");
  state.guest.team[0].hp = 0;
  state.guest.team[1].hp = 0;
  state.guest.team[2].hp = 1;
  state.guest.team[0].heldItem = null;
  state.guest.team[2].heldItem = "phoenix-heart";
  state.guest.active = 2;
  const next = resolveAction(state, "host", { type: "attack", moveId: "hit", actionId: "last-phoenix" });
  const expectedRecovery = Math.ceil(next.guest.team[2].maxHp * catalog.getItemDefinition("phoenix-heart").rules.healPercent);
  assert.equal(next.guest.team[2].hp, expectedRecovery);
  assert.equal(next.guest.team[2].heldItem, null);
  assert.notEqual(next.status, "finished");
  assert.equal(next.winner, null);
  assert.deepEqual(next.effect.faintEvents || [], []);
});

test("a final resolved faint emits one canonical FAINT event before battle result", () => {
  const state = makeState();
  state.guest.team[0].hp = 0;
  state.guest.team[1].hp = 0;
  state.guest.team[2].hp = 1;
  state.guest.active = 2;
  const next = resolveAction(state, "host", { type: "attack", moveId: "hit", actionId: "final-faint" });
  assert.equal(next.status, "finished");
  assert.deepEqual(next.effect.faintEvents, [{
    type: "FAINT", eventId: "final-faint:faint:6", pokemonId: 6, pokemonName: "P6", owner: "guest",
    sourcePokemonId: 1, sourcePokemonName: "P1", cause: "damage", finalHp: 0,
  }]);
});

test("Phoenix Heart uses the same lethal interceptor for end-of-turn status damage", () => {
  const state = makeState("phoenix-heart");
  state.host.team[0].hp = 1;
  state.host.team[0].status = { id: "poison" };
  const next = resolveAction(state, "host", { type: "attack", moveId: "hit", actionId: "poison-phoenix" });
  const expectedRecovery = Math.ceil(next.host.team[0].maxHp * catalog.getItemDefinition("phoenix-heart").rules.healPercent);
  assert.equal(next.host.team[0].hp, expectedRecovery);
  assert.equal(next.host.team[0].heldItem, null);
  assert.notEqual(next.status, "finished");
});

test("final status damage emits the same canonical FAINT event", () => {
  const state = makeState();
  state.host.team[0].hp = 1;
  state.host.team[0].status = { id: "poison" };
  const next = resolveAction(state, "host", { type: "attack", moveId: "hit", actionId: "poison-faint" });
  assert.equal(next.effect.faintEvents[0].type, "FAINT");
  assert.equal(next.effect.faintEvents[0].cause, "status");
  assert.equal(next.effect.faintEvents[0].finalHp, 0);
});

test("all V1 ability hooks resolve through the shared engine", () => {
  const reactive = [
    ["poison-point", "poison"], ["static", "paralysis"], ["flame-body", "burn"], ["effect-spore", "poison"],
  ];
  for (const [abilityId, status] of reactive) {
    const state = makeState();
    state.guest.team[0].abilityId = abilityId;
    state.guest.team[0].ability = abilityId;
    state.host.team[0].moves.find((move) => move.id === "hit").makesContact = true;
    state.rng = 8; // accuracy roll then a deterministic successful ability roll
    const next = resolveAction(state, "host", { type: "attack", moveId: "hit", actionId: abilityId });
    assert.equal(abilityId === "effect-spore" ? ["poison", "paralysis", "sleep"].includes(next.host.team[0].status?.id) : next.host.team[0].status?.id === status, true);
    assert.equal(next.effect.abilityEvents.some((event) => event.abilityId === abilityId), true);
  }
  for (const [abilityId, type] of [["water-absorb", "water"], ["volt-absorb", "electric"], ["levitate", "ground"], ["flash-fire", "fire"]]) {
    const state = makeState();
    state.guest.team[0].abilityId = abilityId;
    state.host.team[0].moves.find((move) => move.id === "hit").type = type;
    state.guest.team[0].hp = 50;
    const next = resolveAction(state, "host", { type: "attack", moveId: "hit", actionId: abilityId });
    assert.equal(next.effect.damage, 0);
    assert.equal(next.guest.team[0].hp, abilityId === "levitate" || abilityId === "flash-fire" ? 50 : 75);
  }
});

test("low HP boosts, field stages and Synchronize are battle-only", () => {
  for (const [abilityId, type] of [["overgrow", "grass"], ["blaze", "fire"], ["torrent", "water"], ["swarm", "bug"]]) {
    const attacker = pokemon(1, null, 33, 5, type);
    attacker.abilityId = abilityId;
    const boosted = calculateDamage({ attacker, defender: pokemon(2), move: { ...attacker.moveset[0], type }, variance: 1 });
    attacker.hp = 34;
    const normal = calculateDamage({ attacker, defender: pokemon(2), move: { ...attacker.moveset[0], type }, variance: 1 });
    assert.ok(boosted.damage > normal.damage);
  }
  const entered = makeState();
  entered.host.team[1].abilityId = "intimidate";
  const switched = resolveAction(entered, "host", { type: "switch", index: 1 });
  assert.equal(switched.guest.team[0].temporaryEffects.statStages.attack, -1);
  switched.guest.team[0].abilityId = "speed-boost";
  switched.turn = "guest";
  const speed = resolveAction(switched, "guest", { type: "attack", moveId: "hit" });
  assert.equal(speed.guest.team[0].temporaryEffects.statStages.speed, 1);
  const sync = makeState();
  sync.guest.team[0].abilityId = "synchronize";
  sync.host.team[0].moves.find((move) => move.id === "hit").statusEffect = { id: "burn", chance: 1 };
  const reflected = resolveAction(sync, "host", { type: "attack", moveId: "hit", actionId: "sync" });
  assert.equal(reflected.guest.team[0].status.id, "burn");
  assert.equal(reflected.host.team[0].status.id, "burn");
  assert.equal(reflected.effect.abilityEvents.filter((event) => event.abilityId === "synchronize").length, 1);
});

test("move decision analysis exposes facts without rolling or choosing for the player", () => {
  const attacker = pokemon(1, null, 30, 5, "fire");
  attacker.abilityId = "blaze";
  const defender = pokemon(2, null, 100, 5, "grass");
  defender.abilityId = "static";
  const contact = { ...attacker.moveset[0], type: "fire", makesContact: true };
  const analysis = analyzeMoveDecision({ attacker, defender, move: contact });
  assert.equal(analysis.attackerAbilityBoost.ability.id, "blaze");
  assert.equal(analysis.contactRisk.ability.id, "static");
  assert.equal(analysis.effectiveness > 1, true);
  assert.equal(attacker.status, undefined);
  defender.abilityId = "water-absorb";
  const absorbed = analyzeMoveDecision({ attacker, defender, move: { ...contact, type: "water" } });
  assert.equal(absorbed.blockedByAbility, true);
  assert.equal(absorbed.primary.kind, "blocked");
  const safe = analyzeMoveDecision({ attacker, defender: { ...defender, abilityId: "static" }, move: { ...contact, makesContact: false } });
  assert.equal(safe.contactRisk, null);
  assert.equal(safe.contactRelevant, true);
});

test("move decision analysis covers every V1 ability decision without treating chance as certainty", () => {
  const attacker = pokemon(1, null, 33, 5, "fire");
  const defender = pokemon(2, null, 100, 5, "normal");
  const contact = { ...attacker.moveset[0], makesContact: true };

  for (const [abilityId, status] of [["poison-point", "poison"], ["static", "paralysis"], ["flame-body", "burn"], ["effect-spore", "sleep"]]) {
    defender.abilityId = abilityId;
    const decision = analyzeMoveDecision({ attacker, defender, move: contact });
    assert.equal(decision.contactRisk.ability.id, abilityId);
    assert.equal(decision.contactRisk.statuses.includes(status), true);
    assert.equal(decision.contactRisk.chance, 0.3);
  }

  for (const [abilityId, type] of [["water-absorb", "water"], ["volt-absorb", "electric"], ["levitate", "ground"], ["flash-fire", "fire"]]) {
    defender.abilityId = abilityId;
    const decision = analyzeMoveDecision({ attacker, defender, move: { ...contact, type } });
    assert.equal(decision.blockedByAbility, true);
    assert.equal(decision.primary.ability.id, abilityId);
  }

  for (const [abilityId, type] of [["overgrow", "grass"], ["blaze", "fire"], ["torrent", "water"], ["swarm", "bug"]]) {
    attacker.abilityId = abilityId;
    const boosted = analyzeMoveDecision({ attacker, defender: { ...defender, abilityId: null }, move: { ...contact, type } });
    const ordinary = analyzeMoveDecision({ attacker, defender: { ...defender, abilityId: null }, move: { ...contact, type: "normal" } });
    assert.equal(boosted.attackerAbilityBoost.ability.id, abilityId);
    assert.equal(ordinary.attackerAbilityBoost, null);
  }

  defender.abilityId = "synchronize";
  const synchronized = analyzeMoveDecision({ attacker, defender, move: { ...contact, statusEffect: { id: "burn", chance: 0.3 } } });
  assert.equal(synchronized.synchronizeRisk, true);
  const noStatusMove = analyzeMoveDecision({ attacker, defender, move: contact });
  assert.equal(noStatusMove.synchronizeRisk, false);

  attacker.temporaryEffects = { statStages: { attack: -1 } };
  const physical = analyzeMoveDecision({ attacker, defender, move: contact });
  const special = analyzeMoveDecision({ attacker, defender, move: { ...contact, damageClass: "special" } });
  assert.equal(physical.attackReduced, true);
  assert.equal(special.attackReduced, false);

  attacker.abilityId = "speed-boost";
  const speedBoost = analyzeMoveDecision({ attacker, defender: { ...defender, abilityId: null }, move: contact });
  assert.equal(speedBoost.warnings.some((warning) => warning.ability?.id === "speed-boost"), false);
});

test("damage preview is pure and bounds every ordinary authoritative damage roll", () => {
  const attacker = { ...pokemon(81, null, 100, 5, "fire"), momentum: 2, temporaryEffects: {}, types: ["fire"] };
  const defender = { ...pokemon(82, null, 100, 5, "grass"), temporaryEffects: {}, types: ["grass"] };
  const move = { id: "technical", name: "Fire Fang", type: "fire", power: 60, accuracy: 100, damageClass: "physical", role: "TECHNICAL", makesContact: true, special: false, traits: ["BITE"] };
  const before = structuredClone(attacker);
  const preview = getDamagePreview({ attacker, defender, move });
  assert.deepEqual(attacker, before);
  assert.equal(preview.blocked, false);
  for (const variance of [.95, .97, 1, 1.03, 1.05]) {
    const result = calculateDamage({ attacker, defender, move, variance });
    assert.ok(result.damage >= preview.minDamage && result.damage <= preview.maxDamage, `${result.damage} outside ${preview.minDamage}-${preview.maxDamage}`);
  }
});

test("Bulbasaur Lv.10 opening Solar Beam stays threatening without erasing Guzzlord's high-HP advantage", () => {
  const guzzlord = {
    id: "guzzlord", name: "Guzzlord", level: 10, type: "dark", types: ["dark", "dragon"],
    maxHp: 323, hp: 323,
    stats: { attack: 146, defense: 77, specialAttack: 141, specialDefense: 77, speed: 62 },
  };
  const bulbasaur = {
    id: "bulbasaur", name: "Bulbasaur", level: 10, type: "grass", types: ["grass", "poison"], abilityId: "overgrow",
    maxHp: 133, hp: 133,
    stats: { attack: 71, defense: 71, specialAttack: 94, specialDefense: 94, speed: 65 },
    moveset: [
      { id: "vine-whip", name: "Vine Whip", type: "grass", power: 40, accuracy: 100, damageClass: "physical", special: false },
      { id: "razor-leaf", name: "Razor Leaf", type: "grass", power: 60, accuracy: 100, damageClass: "physical", special: false },
      { id: "solar-beam", name: "Solar Beam", type: "grass", power: 90, accuracy: 100, damageClass: "special", special: true },
    ],
  };
  const state = createBattleState({ team: [guzzlord] }, { team: [bulbasaur] }, "guest");
  const solarBeam = state.guest.team[0].moves.find((move) => move.id === "solar-beam");
  const preview = getDamagePreview({ attacker: state.guest.team[0], defender: state.host.team[0], move: solarBeam });
  const next = resolveAction(state, "guest", { type: "attack", moveId: "solar-beam", actionId: "bulbasaur-opening" });
  const diagnostic = next.effect.damageDiagnostic;
  assert.deepEqual([preview.minDamage, preview.maxDamage], [85, 94]);
  assert.equal(next.effect.damage, 93);
  assert.equal(next.host.team[0].hp, 230);
  assert.equal(diagnostic.attackStat, "specialAttack");
  assert.equal(diagnostic.defenseStat, "specialDefense");
  assert.equal(diagnostic.stabMultiplier, 1.1);
  assert.equal(diagnostic.typeMultiplier, 1);
  assert.equal(diagnostic.abilityMultiplier, 1);
  assert.equal(diagnostic.itemMultiplier, 1);
  assert.equal(diagnostic.criticalMultiplier, 1);
  assert.equal(diagnostic.effectiveDamageHp, 222.65);
  assert.equal(diagnostic.hpInvariantHolds, true);
  assert.equal(diagnostic.hpBefore - diagnostic.hpAfterDamage, diagnostic.damageApplied);
  assert.ok(next.effect.damage >= preview.minDamage && next.effect.damage <= preview.maxDamage);
});

test("V2 damage curve preserves stat, power, type and HP archetype ordering", () => {
  const attacker = { ...pokemon(301, null, 100, 5, "fire"), types: ["fire"], temporaryEffects: {} };
  const defender = { ...pokemon(302, null, 100, 5, "normal"), types: ["normal"], temporaryEffects: {} };
  const physical = (power) => ({ id: `physical-${power}`, name: `Physical ${power}`, type: "fire", power, accuracy: 100, damageClass: "physical", special: false });
  const special = { id: "special", name: "Special", type: "fire", power: 90, accuracy: 100, damageClass: "special", special: true };
  const damage = (options = {}) => calculateDamage({ attacker: options.attacker || attacker, defender: options.defender || defender, move: options.move || physical(60), variance: 1 }).damage;

  assert.ok(damage({ move: physical(40) }) < damage({ move: physical(60) }));
  assert.ok(damage({ move: physical(60) }) < damage({ move: physical(90) }));
  assert.ok(damage({ attacker: { ...attacker, stats: { ...attacker.stats, attack: 80 } } }) > damage({ attacker: { ...attacker, stats: { ...attacker.stats, attack: 40 } } }));
  assert.ok(damage({ defender: { ...defender, stats: { ...defender.stats, defense: 100 } } }) < damage({ defender: { ...defender, stats: { ...defender.stats, defense: 30 } } }));
  assert.ok(damage({ attacker: { ...attacker, stats: { ...attacker.stats, specialAttack: 90 } }, move: special }) > damage({ attacker: { ...attacker, stats: { ...attacker.stats, specialAttack: 30 } }, move: special }));
  assert.ok(damage({ defender: { ...defender, stats: { ...defender.stats, specialDefense: 100 } }, move: special }) < damage({ defender: { ...defender, stats: { ...defender.stats, specialDefense: 30 } }, move: special }));
  assert.ok(damage({ defender: { ...defender, types: ["grass"] } }) > damage({ defender }));
  assert.ok(damage({ defender }) > damage({ defender: { ...defender, types: ["water"] } }));
  assert.ok(damage({ attacker: { ...attacker, types: ["normal"], type: "normal" } }) < damage());

  const highHp = { ...defender, maxHp: 323, hp: 323 };
  const lowHp = { ...defender, maxHp: 100, hp: 100 };
  const highHpDamage = damage({ defender: highHp });
  const lowHpDamage = damage({ defender: lowHp });
  assert.ok(highHpDamage > lowHpDamage);
  assert.ok(highHpDamage / highHp.maxHp < lowHpDamage / lowHp.maxHp);
  assert.ok(highHp.maxHp / highHpDamage > lowHp.maxHp / lowHpDamage);

  assert.ok(damage({ attacker: { ...attacker, level: 10 } }) > damage({ attacker: { ...attacker, level: 1 } }));
  const degenerate = calculateDamage({ attacker: { ...attacker, stats: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0 } }, defender: { ...defender, stats: { attack: 0, defense: 0, specialAttack: 0, specialDefense: 0 } }, move: physical(40), variance: 1 });
  assert.ok(Number.isFinite(degenerate.damage) && degenerate.damage >= 1);
});

test("Fast gains battle-local momentum and Technical consumes its exact previewed bonus", () => {
  const fast = { ...pokemon(91, null, 100, 5, "fire"), moveset: [
    { id: "fast", name: "Ember", type: "fire", power: 40, accuracy: 100, damageClass: "special", role: "FAST", special: false },
    { id: "technical", name: "Fire Fang", type: "fire", power: 60, accuracy: 100, damageClass: "physical", role: "TECHNICAL", special: false },
    { id: "special", name: "Flamethrower", type: "fire", power: 90, accuracy: 100, damageClass: "special", special: true },
  ] };
  let state = createBattleState({ team: [fast] }, { team: [pokemon(92, null, 100, 5, "grass")] }, "host");
  state = resolveAction(state, "host", { type: "attack", moveId: "fast", actionId: "fast-1" });
  assert.equal(state.host.team[0].momentum, 1);
  assert.equal(state.effect.momentumEvent.type, "MOMENTUM_GAINED");
  state.turn = "host";
  const technical = state.host.team[0].moves.find((move) => move.id === "technical");
  const preview = getDamagePreview({ attacker: state.host.team[0], defender: state.guest.team[0], move: technical });
  state = resolveAction(state, "host", { type: "attack", moveId: "technical", actionId: "technical-1" });
  assert.ok(state.effect.damage >= preview.minDamage && state.effect.damage <= preview.maxDamage);
  assert.equal(state.host.team[0].momentum, 0);
  assert.equal(state.effect.momentumEvent.type, "MOMENTUM_CONSUMED");
});

test("elemental relic hydration and the canonical preview apply its configured bonus once", () => {
  const attacker = { ...pokemon(401, null, 100, 5, "grass"), types: ["grass", "poison"], elementalRelic: "semente-ancestral", temporaryEffects: {} };
  const defender = { ...pokemon(402, null, 100, 5, "water"), types: ["water"], temporaryEffects: {} };
  const move = { id: "leaf", name: "Leaf", type: "grass", power: 60, accuracy: 100, damageClass: "special", special: true };
  const withRelic = calculateDamage({ attacker, defender, move, variance: 1 });
  const withoutRelic = calculateDamage({ attacker: { ...attacker, elementalRelic: null }, defender, move, variance: 1 });
  const expectedMultiplier = globalThis.__itemCatalog.getItemDefinition("semente-ancestral").rules.baseMultiplier;
  assert.equal(withRelic.itemTriggers.filter((entry) => entry.itemId === "semente-ancestral").length, 1);
  assert.equal(withRelic.itemTriggers[0].multiplier, expectedMultiplier);
  assert.ok(withRelic.damage > withoutRelic.damage);
  const preview = getDamagePreview({ attacker, defender, move });
  assert.ok(preview.expectedDamage >= withoutRelic.damage);
});
