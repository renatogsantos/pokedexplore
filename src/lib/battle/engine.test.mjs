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
  );
const {
  MAX_HEALS_PER_POKEMON,
  MAX_SPECIAL_ATTACK_USES,
  calculateDamage,
  createBattleState,
  getBattleMoves,
  resolveAction,
  resolvePostDamageHeldItem,
} = await import(
  `data:text/javascript;base64,${Buffer.from(engineSource).toString("base64")}`
);

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

test("catalog exposes the complete original collection", () => {
  assert.equal(catalog.ITEM_CATALOG.length, 28);
  assert.equal(catalog.HELD_ITEM_CATALOG.length, 22);
  assert.equal(catalog.BAG_ITEM_CATALOG.length, 6);
  assert.equal(new Set(catalog.ITEM_CATALOG.map((item) => item.id)).size, 28);
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
  assert.equal(resolvePostDamageHeldItem(core).effect.amount, 35);
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
  assert.equal(revived.guest.team[0].hp, 60);
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
      (event) => event.itemId === "impact-crystal" && event.consumed,
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
