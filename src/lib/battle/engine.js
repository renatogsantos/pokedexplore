import {
  BAG_ITEM_CATALOG,
  getItemDefinition,
  migrateLegacyItemId,
} from "@/lib/items/catalog";
import {
  isSupportedStatus,
  normalizeStatusEffect,
} from "@/lib/battle/statuses";

// Framework-free, deterministic battle domain. The host runs this same
// pipeline for CPU, friends, tournaments and Badge Challenges.
const ADVANTAGES = {
  electric: ["water", "flying"],
  water: ["fire", "ground", "rock"],
  fire: ["grass", "ice", "bug", "steel"],
  grass: ["water", "ground", "rock"],
  fighting: ["normal", "rock", "steel", "ice", "dark"],
  ground: ["fire", "electric", "poison", "rock", "steel"],
  psychic: ["fighting", "poison"],
  ice: ["grass", "ground", "flying", "dragon"],
  dark: ["psychic", "ghost"],
  ghost: ["psychic", "ghost"],
  fairy: ["fighting", "dragon", "dark"],
  rock: ["fire", "ice", "flying", "bug"],
  flying: ["grass", "fighting", "bug"],
  poison: ["grass", "fairy"],
  bug: ["grass", "psychic", "dark"],
  steel: ["ice", "rock", "fairy"],
  dragon: ["dragon"],
};

export const MAX_SPECIAL_ATTACK_USES = 2;
export const MAX_POTIONS = 2; // compatibility only; Bag stock now comes from inventory.
export const MAX_HEALS_PER_POKEMON = 3;
export const POTION_HEAL_PERCENTAGE = 0.4;
export const STATUS_DAMAGE_PERCENTAGE = 0.08;
export const PARALYSIS_ACTION_BLOCK_CHANCE = 0.25;
export const BATTLE_BAG = Object.freeze(
  Object.fromEntries(
    BAG_ITEM_CATALOG.map((entry) => [
      entry.id,
      {
        id: entry.id,
        name: entry.name,
        quantity: 0,
        description: entry.shortDescription,
      },
    ]),
  ),
);
export const DAMAGE_BALANCE = Object.freeze({
  SUPER_EFFECTIVE: 1.3,
  DOUBLE_WEAKNESS_CAP: 1.5,
  RESISTED: 0.75,
  STAB: 1.1,
  MIN_ATTACK_RATIO: 0.65,
  MAX_ATTACK_RATIO: 1.55,
  REGULAR_MIN: 0.06,
  REGULAR_MAX: 0.35,
  SPECIAL_MIN: 0.1,
  SPECIAL_MAX: 0.45,
  VARIANCE: 0.05,
});
export const HELD_ITEM_TRIGGER = Object.freeze({
  AFTER_DAMAGE_RECEIVED: "AFTER_DAMAGE",
  DAMAGE_CALCULATION: "DAMAGE_CALCULATION",
});
export const HELD_ITEM_DEFINITIONS = Object.freeze(
  Object.fromEntries(
    [
      "fruit-vital",
      "healing-core",
      "regeneration-leaf",
      "survival-amulet",
      "guardian-plate",
      "resistance-crystal",
      "arcane-mirror",
      "purifier",
      "power-claw",
      "elemental-core",
      "impact-crystal",
      "unstable-charge",
      "impulse-boots",
      "return-symbol",
      "strategist-eye",
      "poison-thorn",
      "vampiric-crystal",
      "special-fragment",
      "phoenix-heart",
      "challenger-crown",
      "void-fragment",
      "celestial-clock",
    ].map((id) => [id, getItemDefinition(id)]),
  ),
);
const itemRules = (id) => getItemDefinition(id)?.rules || {};

// The battle keeps its simplified power curve, but status metadata is normalized
// per move from PokéAPI's structured meta.ailment/meta.ailment_chance fields.
// Never infer an ailment from the elemental type.
const move = (name, options = {}) => Object.freeze({ name, ...options });
const TYPE_MOVES = Object.freeze({
  normal: [move("Tackle"), move("Quick Attack"), move("Hyper Beam")],
  fire: [
    move("Ember", {
      damageClass: "special",
      statusEffect: { id: "burn", chance: 0.1 },
    }),
    move("Fire Fang", { statusEffect: { id: "burn", chance: 0.1 } }),
    move("Flamethrower", {
      damageClass: "special",
      statusEffect: { id: "burn", chance: 0.1 },
    }),
  ],
  water: [
    move("Water Gun", { damageClass: "special" }),
    move("Aqua Tail"),
    move("Hydro Pump", { damageClass: "special" }),
  ],
  grass: [
    move("Vine Whip"),
    move("Razor Leaf"),
    move("Solar Beam", { damageClass: "special" }),
  ],
  electric: [
    move("Thunder Shock", {
      damageClass: "special",
      statusEffect: { id: "paralysis", chance: 0.1 },
    }),
    move("Spark", { statusEffect: { id: "paralysis", chance: 0.3 } }),
    move("Thunderbolt", {
      damageClass: "special",
      statusEffect: { id: "paralysis", chance: 0.1 },
    }),
  ],
  ice: [
    move("Powder Snow", { damageClass: "special" }),
    move("Ice Fang"),
    move("Ice Beam", { damageClass: "special" }),
  ],
  fighting: [move("Karate Chop"), move("Brick Break"), move("Close Combat")],
  poison: [
    move("Poison Sting", { statusEffect: { id: "poison", chance: 0.3 } }),
    move("Acid", { damageClass: "special" }),
    move("Sludge Bomb", {
      damageClass: "special",
      statusEffect: { id: "poison", chance: 0.3 },
    }),
  ],
  ground: [
    move("Mud-Slap", { damageClass: "special" }),
    move("Bulldoze"),
    move("Earthquake"),
  ],
  flying: [
    move("Peck"),
    move("Wing Attack"),
    move("Air Slash", { damageClass: "special" }),
  ],
  psychic: [
    move("Confusion", { damageClass: "special" }),
    move("Psybeam", { damageClass: "special" }),
    move("Psychic", { damageClass: "special" }),
  ],
  bug: [
    move("Bug Bite"),
    move("X-Scissor"),
    move("Bug Buzz", { damageClass: "special" }),
  ],
  rock: [move("Rock Throw"), move("Rock Slide"), move("Stone Edge")],
  ghost: [
    move("Astonish"),
    move("Shadow Sneak"),
    move("Shadow Ball", { damageClass: "special" }),
  ],
  dragon: [
    move("Dragon Breath", { damageClass: "special" }),
    move("Dragon Claw"),
    move("Dragon Pulse", { damageClass: "special" }),
  ],
  dark: [
    move("Bite"),
    move("Assurance"),
    move("Dark Pulse", { damageClass: "special" }),
  ],
  steel: [
    move("Metal Claw"),
    move("Iron Head"),
    move("Flash Cannon", { damageClass: "special" }),
  ],
  fairy: [
    move("Fairy Wind", { damageClass: "special" }),
    move("Draining Kiss", { damageClass: "special" }),
    move("Moonblast", { damageClass: "special" }),
  ],
});
const ABILITIES = { blaze: "fire", torrent: "water", overgrow: "grass" };
export const SUPPORTED_ABILITIES = Object.freeze({
  blaze: "Com pouco HP, golpes Fire causam +20% de dano.",
  torrent: "Com pouco HP, golpes Water causam +20% de dano.",
  overgrow: "Com pouco HP, golpes Grass causam +20% de dano.",
  static: "Golpes físicos recebidos podem causar paralisia.",
});
export const MOVES = [
  {
    id: "strike",
    name: "Investida",
    type: "normal",
    power: 40,
    accuracy: 100,
    damageClass: "physical",
    special: false,
  },
  {
    id: "type-strike",
    name: "Golpe de tipo",
    type: "own",
    power: 70,
    accuracy: 100,
    damageClass: "special",
    special: true,
  },
];

const normalizeTypes = (value) =>
  Array.isArray(value)
    ? value
    : Array.isArray(value?.types)
      ? value.types
          .map((type) =>
            typeof type === "string" ? type : type.type?.name || type.name,
          )
          .filter(Boolean)
      : [value?.type || value].filter(Boolean);
const heldItemId = (value) => migrateLegacyItemId(value);
const activeItem = (fighter, id) => heldItemId(fighter?.heldItem) === id;
const nextRandom = (state) => {
  const seed = ((state.rng || 123456789) * 1664525 + 1013904223) >>> 0;
  state.rng = seed;
  return seed / 4294967296;
};
const hpRatio = (fighter) => getHpRatio(fighter?.hp, fighter?.maxHp);
const heal = (fighter, amount) => {
  const actual = Math.min(
    Math.max(0, Math.ceil(amount)),
    Math.max(0, fighter.maxHp - fighter.hp),
  );
  fighter.hp += actual;
  return actual;
};
const consumeHeld = (fighter, itemId, eventId, effect = {}, owner = null) => {
  fighter.heldItem = null;
  return {
    type: "held-item-activated",
    itemId,
    pokemonId: fighter.id,
    targetPokemonId: fighter.id,
    eventId,
    owner,
    effect,
    consumed: true,
  };
};
const addItemEvent = (effect, event) => {
  if (!event) return;
  effect.itemEvents = [...(effect.itemEvents || []), event];
  if (event.consumed && !effect.heldItem) effect.heldItem = event;
};
const addStatusEvent = (effect, event) => {
  if (!event) return;
  effect.statusEvents = [...(effect.statusEvents || []), event];
  effect.statusEvent = event;
};

export function getSupportedAbility(ability) {
  return SUPPORTED_ABILITIES[ability]
    ? { id: ability, description: SUPPORTED_ABILITIES[ability] }
    : null;
}
export function multiplier(attackType, defender) {
  return normalizeTypes(defender).reduce(
    (total, defenseType) =>
      total *
      (ADVANTAGES[attackType]?.includes(defenseType)
        ? DAMAGE_BALANCE.SUPER_EFFECTIVE
        : ADVANTAGES[defenseType]?.includes(attackType)
          ? DAMAGE_BALANCE.RESISTED
          : 1),
    1,
  );
}
export function getTypeEffectiveness(attackType, defender) {
  return Math.min(
    DAMAGE_BALANCE.DOUBLE_WEAKNESS_CAP,
    multiplier(attackType, defender),
  );
}
export function getOpponentWeaknesses(defender) {
  return Object.keys(ADVANTAGES).filter(
    (attackType) => multiplier(attackType, defender) > 1,
  );
}
export function getPokemonMatchup(attacker, defender) {
  const factor = getTypeEffectiveness(
    normalizeTypes(attacker)[0] || "normal",
    defender,
  );
  return factor > 1 ? "advantage" : factor < 1 ? "disadvantage" : "neutral";
}
export function getHpRatio(currentHp, maxHp) {
  return maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
}
export function getPotionHealAmount(pokemon, percent = POTION_HEAL_PERCENTAGE) {
  return Math.min(
    Math.ceil(pokemon.maxHp * percent),
    pokemon.maxHp - pokemon.hp,
  );
}
export function normalizeBattleMove(rawMove, fallback = {}) {
  const normalized = { ...fallback, ...rawMove };
  return {
    ...normalized,
    statusEffect: normalizeStatusEffect(normalized),
  };
}

export function getBattleMoves(pokemon) {
  const type = normalizeTypes(pokemon)[0] || "normal";
  const definitions = TYPE_MOVES[type] || TYPE_MOVES.normal;
  const slots = [
    {
      id: `${type}-quick`,
      type,
      power: 40,
      accuracy: 100,
      damageClass: "physical",
      special: false,
    },
    {
      id: `${type}-steady`,
      type,
      power: 60,
      accuracy: 100,
      damageClass: "physical",
      special: false,
    },
    {
      id: `${type}-special`,
      type,
      power: 90,
      accuracy: 100,
      damageClass: "special",
      special: true,
    },
  ];
  return definitions.map((definition, index) =>
    normalizeBattleMove(definition, slots[index]),
  );
}

function prepareFighter(pokemon) {
  const types = normalizeTypes(pokemon);
  const base = pokemon.baseStats || {};
  const maxHp = pokemon.maxHp || base.hp || 90;
  const stats = {
    attack: pokemon.stats?.attack || base.attack || 50,
    defense: pokemon.stats?.defense || base.defense || 50,
    specialAttack:
      pokemon.stats?.specialAttack || base.specialAttack || base.attack || 50,
    specialDefense:
      pokemon.stats?.specialDefense ||
      base.specialDefense ||
      base.defense ||
      50,
    speed: pokemon.stats?.speed || base.speed || 50,
  };
  const defaults = getBattleMoves({ ...pokemon, types });
  const custom = Array.isArray(pokemon.moveset)
    ? pokemon.moveset
        .filter((entry) => entry?.id && Number.isFinite(Number(entry?.power)))
        .map((entry) => normalizeBattleMove(entry))
    : [];
  return {
    ...pokemon,
    types,
    type: types[0] || "normal",
    hp: pokemon.hp ?? maxHp,
    maxHp,
    stats,
    moves:
      custom.length >= 3
        ? custom.slice(0, 4)
        : [
            ...defaults,
            ...custom.filter(
              (move) => !defaults.some((entry) => entry.id === move.id),
            ),
          ].slice(0, 4),
    status: pokemon.status || null,
    heldItem: heldItemId(pokemon.heldItem),
    ability: pokemon.ability || null,
    specialAttackUsesRemaining: MAX_SPECIAL_ATTACK_USES,
    healsUsed: 0,
    rechargeUsed: false,
    temporaryEffects: {},
  };
}
function abilityBonus(fighter, type) {
  return ABILITIES[fighter.ability] === type && hpRatio(fighter) <= 1 / 3
    ? 1.2
    : 1;
}
export function getMovePowerFactor(power = 40, special = false) {
  const base =
    power <= 40
      ? 0.15
      : power <= 60
        ? 0.18
        : power <= 80
          ? 0.21
          : power <= 100
            ? 0.24
            : 0.27;
  return base * (special ? 1.25 : 1);
}

export function calculateDamage({ attacker, defender, move, variance = 1 }) {
  const attackType = move.type === "own" ? attacker.type : move.type;
  const attack =
    move.damageClass === "special"
      ? attacker.stats.specialAttack
      : attacker.stats.attack;
  const defense =
    move.damageClass === "special"
      ? defender.stats.specialDefense
      : defender.stats.defense;
  const ratio = Math.min(
    DAMAGE_BALANCE.MAX_ATTACK_RATIO,
    Math.max(DAMAGE_BALANCE.MIN_ATTACK_RATIO, attack / Math.max(1, defense)),
  );
  const levelFactor = Math.min(
    1.2,
    Math.max(0.85, 1 + ((attacker.level || 1) - (defender.level || 1)) * 0.025),
  );
  const effectiveness = getTypeEffectiveness(attackType, defender);
  const stab = attacker.types.includes(attackType) ? DAMAGE_BALANCE.STAB : 1;
  const special = Boolean(move.special);
  const minimum = special
    ? DAMAGE_BALANCE.SPECIAL_MIN
    : DAMAGE_BALANCE.REGULAR_MIN;
  const maximum = special
    ? DAMAGE_BALANCE.SPECIAL_MAX
    : DAMAGE_BALANCE.REGULAR_MAX;
  let outgoing = abilityBonus(attacker, attackType);
  let incoming = 1;
  const itemTriggers = [];
  if (activeItem(attacker, "power-claw"))
    outgoing *= itemRules("power-claw").dealtMultiplier ?? 1.2;
  if (
    activeItem(attacker, "elemental-core") &&
    attacker.types?.[0] === attackType
  ) {
    const multiplier = itemRules("elemental-core").multiplier ?? 1.22;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "elemental-core",
      consumed: false,
      multiplier,
    });
  }
  if (activeItem(attacker, "impact-crystal")) {
    const multiplier = itemRules("impact-crystal").multiplier ?? 1.2;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "impact-crystal",
      consumed: true,
      multiplier,
      owner: "attacker",
    });
  }
  if (
    activeItem(attacker, "unstable-charge") &&
    hpRatio(attacker) <= (itemRules("unstable-charge").hpRatioLTE ?? 0.4)
  )
    outgoing *= itemRules("unstable-charge").multiplier ?? 1.15;
  if (attacker.temporaryEffects?.impulse) {
    const multiplier = itemRules("impulse-boots").multiplier ?? 1.3;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "impulse-boots",
      temporary: "impulse",
      multiplier,
    });
  }
  if (attacker.temporaryEffects?.stimulant) {
    const multiplier = itemRules("stimulant").multiplier ?? 1.35;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "stimulant",
      temporary: "stimulant",
      multiplier,
    });
  }
  if (attacker.temporaryEffects?.phoenix) {
    const multiplier = itemRules("phoenix-heart").multiplier ?? 1.25;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "phoenix-heart",
      temporary: "phoenix",
      multiplier,
    });
  }
  if (activeItem(attacker, "special-fragment") && special) {
    const multiplier = itemRules("special-fragment").multiplier ?? 1.15;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "special-fragment",
      consumed: true,
      multiplier,
      owner: "attacker",
    });
  }
  if (
    activeItem(attacker, "challenger-crown") &&
    (defender.level || 1) > (attacker.level || 1)
  )
    outgoing *= itemRules("challenger-crown").dealtMultiplier ?? 1.25;
  if (activeItem(attacker, "strategist-eye") && effectiveness > 1) {
    const multiplier =
      itemRules("strategist-eye").superEffectiveMultiplier ?? 1.15;
    outgoing *= multiplier;
    itemTriggers.push({
      itemId: "strategist-eye",
      consumed: false,
      multiplier,
    });
  }
  if (activeItem(defender, "power-claw"))
    incoming *= itemRules("power-claw").receivedMultiplier ?? 1.08;
  if (activeItem(defender, "guardian-plate")) {
    const multiplier = itemRules("guardian-plate").multiplier ?? 0.75;
    incoming *= multiplier;
    itemTriggers.push({
      itemId: "guardian-plate",
      consumed: true,
      multiplier,
      owner: "defender",
    });
  }
  if (activeItem(defender, "resistance-crystal") && effectiveness > 1)
    incoming *= itemRules("resistance-crystal").multiplier ?? 0.75;
  if (activeItem(defender, "void-fragment") && effectiveness > 1) {
    const multiplier = itemRules("void-fragment").multiplier ?? 0.3;
    incoming *= multiplier;
    itemTriggers.push({
      itemId: "void-fragment",
      consumed: true,
      multiplier,
      owner: "defender",
    });
  }
  if (
    activeItem(defender, "challenger-crown") &&
    (attacker.level || 1) > (defender.level || 1)
  )
    incoming *= itemRules("challenger-crown").receivedMultiplier ?? 0.8;
  if (defender.temporaryEffects?.barrier) {
    const multiplier = itemRules("instant-barrier").multiplier ?? 0.5;
    incoming *= multiplier;
    itemTriggers.push({
      itemId: "instant-barrier",
      temporary: "barrier",
      multiplier,
    });
  }
  const basePercentage = Math.min(
    maximum,
    Math.max(
      minimum,
      getMovePowerFactor(move.power, special) *
        ratio *
        levelFactor *
        stab *
        effectiveness *
        variance,
    ),
  );
  const percentage = basePercentage * outgoing * incoming;
  return {
    damage: Math.max(1, Math.round(defender.maxHp * percentage)),
    percentage,
    effectiveness,
    effectivenessLabel:
      effectiveness > 1
        ? "super-effective"
        : effectiveness < 1
          ? "resisted"
          : "neutral",
    stab: stab > 1,
    attackRatio: ratio,
    special,
    itemTriggers,
    heldItemBonus:
      itemTriggers.find(
        (entry) =>
          entry.owner === "attacker" || entry.itemId === "elemental-core",
      ) || null,
  };
}

export function resolveHeldItemEvent({
  trigger,
  owner,
  targetPokemonId,
  sourcePokemonId = null,
  ownerRole = null,
  eventId = null,
  processedEventIds = [],
}) {
  const definition = getItemDefinition(heldItemId(owner?.heldItem));
  if (
    !definition ||
    definition.usageType !== "HELD" ||
    String(owner?.id) !== String(targetPokemonId) ||
    (eventId && processedEventIds.includes(eventId)) ||
    trigger !== HELD_ITEM_TRIGGER.AFTER_DAMAGE_RECEIVED ||
    definition.trigger !== "AFTER_DAMAGE" ||
    owner.hp <= 0 ||
    hpRatio(owner) > definition.rules.hpRatioLTE
  )
    return null;
  if (definition.effectType === "HEAL_PERCENT") {
    const amount = heal(owner, owner.maxHp * definition.rules.healPercent);
    if (!amount) return null;
    return {
      ...consumeHeld(owner, definition.id, eventId, {
        type: "heal_hp",
        amount,
      }, ownerRole),
      sourcePokemonId,
      beforeHp: owner.hp - amount,
      afterHp: owner.hp,
      trigger,
    };
  }
  if (definition.effectType === "REGENERATION") {
    owner.temporaryEffects.regeneration = {
      ticks: definition.rules.ticks,
      healPercent: definition.rules.healPercent,
    };
    return {
      ...consumeHeld(owner, definition.id, eventId, {
        type: "regeneration",
        ticks: definition.rules.ticks,
      }, ownerRole),
      sourcePokemonId,
      trigger,
    };
  }
  return null;
}
export function resolvePostDamageHeldItem(fighter) {
  return resolveHeldItemEvent({
    trigger: HELD_ITEM_TRIGGER.AFTER_DAMAGE_RECEIVED,
    owner: fighter,
    targetPokemonId: fighter?.id,
  });
}

function applySupportedStatus(target, statusId, context, effect, eventId) {
  if (
    !target ||
    target.hp <= 0 ||
    target.status ||
    !isSupportedStatus(statusId)
  )
    return null;
  const statusEvent = {
    type: "STATUS_APPLIED",
    status: statusId,
    successful: true,
    eventId,
    targetPokemonId: target.id,
    targetPokemonName: target.name,
    targetRole: context.targetRole,
    sourcePokemonId: context.sourcePokemon?.id || null,
    sourcePokemonName: context.sourcePokemon?.name || null,
    sourceRole: context.sourceRole || null,
    sourceKind: context.sourceKind || "move",
    moveId: context.move?.id || null,
    moveName: context.move?.name || null,
    itemId: context.itemId || null,
    abilityId: context.abilityId || null,
    chance: context.chance ?? null,
    appliedTurn: context.appliedTurn,
  };
  const prevention = heldItemId(target.heldItem);
  if (["arcane-mirror", "celestial-clock"].includes(prevention)) {
    const recovery =
      prevention === "celestial-clock"
        ? heal(
            target,
            target.maxHp * (itemRules("celestial-clock").healPercent ?? 0.4),
          )
        : 0;
    addItemEvent(effect, {
      ...consumeHeld(target, prevention, eventId, {
        type: "prevent_status",
        status: statusId,
        healing: recovery,
      }, context.targetRole),
      owner: context.targetRole,
    });
    addStatusEvent(effect, {
      ...statusEvent,
      type: "STATUS_PREVENTED",
      successful: false,
      itemId: prevention,
    });
    return null;
  }
  target.status = {
    id: statusId,
    turns: statusId === "sleep" ? 2 : 0,
    sourcePokemonId: statusEvent.sourcePokemonId,
    sourcePokemonName: statusEvent.sourcePokemonName,
    sourceMoveId: statusEvent.moveId,
    sourceMoveName: statusEvent.moveName,
    sourceKind: statusEvent.sourceKind,
    sourceItemId: statusEvent.itemId,
    sourceAbilityId: statusEvent.abilityId,
    appliedTurn: statusEvent.appliedTurn,
  };
  addStatusEvent(effect, statusEvent);
  if (activeItem(target, "purifier")) {
    target.status = null;
    const recovery = heal(
      target,
      target.maxHp * (itemRules("purifier").healPercent ?? 0.25),
    );
    addItemEvent(effect, {
      ...consumeHeld(target, "purifier", eventId, {
        type: "cure_status",
        status: statusId,
        healing: recovery,
      }, context.targetRole),
      owner: context.targetRole,
    });
    addStatusEvent(effect, {
      ...statusEvent,
      type: "STATUS_CURED",
      sourceKind: "item",
      itemId: "purifier",
    });
  }
  return statusId;
}

function finishActorTurn(next, actor, effect) {
  const fighter = next[actor].team[next[actor].active];
  if (!fighter || fighter.hp <= 0) return;
  if (fighter.status && ["burn", "poison"].includes(fighter.status.id)) {
    const damage = Math.max(
      1,
      Math.ceil(fighter.maxHp * STATUS_DAMAGE_PERCENTAGE),
    );
    fighter.hp = Math.max(0, fighter.hp - damage);
    effect.endStatus = { status: fighter.status.id, damage };
    addStatusEvent(effect, {
      type: "STATUS_DAMAGE",
      status: fighter.status.id,
      damage,
      targetRole: actor,
      targetPokemonId: fighter.id,
      targetPokemonName: fighter.name,
      sourcePokemonId: fighter.status.sourcePokemonId || null,
      sourcePokemonName: fighter.status.sourcePokemonName || null,
      moveId: fighter.status.sourceMoveId || null,
      moveName: fighter.status.sourceMoveName || null,
    });
  }
  if (fighter.hp > 0 && fighter.temporaryEffects?.regeneration?.ticks > 0) {
    const amount = heal(
      fighter,
      fighter.maxHp * fighter.temporaryEffects.regeneration.healPercent,
    );
    fighter.temporaryEffects.regeneration.ticks -= 1;
    if (!fighter.temporaryEffects.regeneration.ticks)
      delete fighter.temporaryEffects.regeneration;
    if (amount)
      addItemEvent(effect, {
        itemId: "regeneration-leaf",
        pokemonId: fighter.id,
        targetPokemonId: fighter.id,
        consumed: false,
        effect: { type: "heal_hp", amount },
      });
  }
}

export function createBattleState(host, guest, firstTurn) {
  const preparePlayer = (player) => {
    const bag = Object.fromEntries(
      BAG_ITEM_CATALOG.map((entry) => [
        entry.id,
        Math.max(0, Math.floor(Number(player.inventory?.[entry.id]) || 0)),
      ]),
    );
    return {
      ...player,
      active: 0,
      bag,
      initialBag: { ...bag },
      potionsRemaining: bag["vital-potion"] || 0,
      team: player.team.map(prepareFighter),
    };
  };
  const preparedHost = preparePlayer(host);
  const preparedGuest = preparePlayer(guest);
  const fasterGuest =
    (preparedGuest.team[0]?.stats.speed || 0) >
    (preparedHost.team[0]?.stats.speed || 0);
  return {
    host: preparedHost,
    guest: preparedGuest,
    turn: firstTurn || (fasterGuest ? "guest" : "host"),
    status: "playing",
    winner: null,
    log: "A batalha começou!",
    effect: null,
    rng: 123456789,
    resolvedItemEventIds: [],
    performance: {
      startedAt: null,
      endedAt: null,
      players: { host: { hasSwitched: false }, guest: { hasSwitched: false } },
    },
    revision: 0,
  };
}

function resolveBagAction(state, next, actor, enemy, action) {
  const itemId =
    action.type === "potion"
      ? "vital-potion"
      : migrateLegacyItemId(action.itemId);
  const definition = getItemDefinition(itemId);
  const targetIndex = next[actor].team.findIndex(
    (pokemon) => String(pokemon.id) === String(action.targetPokemonId),
  );
  const target = next[actor].team[targetIndex];
  const quantity = next[actor].bag?.[itemId] || 0;
  if (
    !definition ||
    definition.usageType !== "BAG" ||
    !target ||
    !quantity ||
    target.hp <= 0
  )
    return state;
  let healing = 0;
  let curedStatus = null;
  if (definition.effectType === "BAG_HEAL") {
    if (target.hp >= target.maxHp || target.healsUsed >= MAX_HEALS_PER_POKEMON)
      return state;
    healing = heal(target, target.maxHp * definition.rules.healPercent);
    if (!healing) return state;
    target.healsUsed += 1;
  } else if (definition.effectType === "BAG_CURE") {
    if (!target.status) return state;
    curedStatus = target.status.id;
    target.status = null;
  } else if (definition.effectType === "BAG_BARRIER") {
    if (targetIndex !== next[actor].active || target.temporaryEffects.barrier)
      return state;
    target.temporaryEffects.barrier = true;
  } else if (definition.effectType === "BAG_STIMULANT") {
    if (targetIndex !== next[actor].active || target.temporaryEffects.stimulant)
      return state;
    target.temporaryEffects.stimulant = true;
  } else if (definition.effectType === "BAG_RECHARGE") {
    if (
      target.specialAttackUsesRemaining >= MAX_SPECIAL_ATTACK_USES ||
      target.rechargeUsed
    )
      return state;
    target.specialAttackUsesRemaining += 1;
    target.rechargeUsed = true;
  } else return state;
  next[actor].bag[itemId] = quantity - 1;
  next[actor].potionsRemaining = next[actor].bag["vital-potion"] || 0;
  next.turn = enemy;
  next.log = `${definition.name} usado em ${target.name}!`;
  next.effect = {
    kind: "item",
    itemId,
    itemName: definition.name,
    actor,
    target: actor,
    targetPokemonId: target.id,
    targetPokemonName: target.name,
    targetIndex,
    healing,
    curedStatus,
    remaining: next[actor].bag[itemId],
    statusEvents: curedStatus
      ? [
          {
            type: "STATUS_CURED",
            status: curedStatus,
            successful: true,
            sourceKind: "item",
            itemId,
            targetRole: actor,
            targetPokemonId: target.id,
            targetPokemonName: target.name,
          },
        ]
      : [],
    result: {
      applied: true,
      consumed: true,
      itemId,
      targetPokemonId: target.id,
      healing,
      curedStatus,
    },
  };
  next.revision += 1;
  return next;
}

export function resolveAction(state, actor, action) {
  if (state.status !== "playing" || state.turn !== actor) return state;
  const enemy = actor === "host" ? "guest" : "host";
  const next = structuredClone(state);
  const fighter = next[actor].team[next[actor].active];
  if (action.type === "switch") {
    const incoming = next[actor].team[action.index];
    if (!incoming || incoming.hp <= 0 || action.index === next[actor].active)
      return state;
    const outgoing = fighter;
    const itemId = heldItemId(outgoing.heldItem);
    const effect = { kind: "switch", actor, itemEvents: [] };
    if (itemId === "return-symbol" && outgoing.hp > 0) {
      const amount = heal(outgoing, outgoing.maxHp * 0.1);
      addItemEvent(
        effect,
        consumeHeld(
          outgoing,
          itemId,
          action.actionId || `${actor}:${state.revision + 1}:switch`,
          { type: "heal_hp", amount },
          actor,
        ),
      );
    }
    next[actor].active = action.index;
    incoming.temporaryEffects.impulse =
      activeItem(incoming, "impulse-boots") || undefined;
    next.performance.players[actor].hasSwitched = true;
    next.turn = enemy;
    next.log = `Vai, ${incoming.name}!`;
    next.effect = effect;
    next.revision += 1;
    return next;
  }
  if (action.type === "potion" || action.type === "item")
    return resolveBagAction(state, next, actor, enemy, action);
  const move =
    fighter.moves.find((entry) => entry.id === action.moveId) ||
    MOVES.find((entry) => entry.id === action.moveId);
  const defender = next[enemy].team[next[enemy].active];
  if (
    !move ||
    !defender ||
    (move.special && fighter.specialAttackUsesRemaining <= 0)
  )
    return state;
  if (fighter.status?.id === "sleep") {
    const sleepingStatus = { ...fighter.status };
    fighter.status.turns -= 1;
    const statusEvents = [
      {
        type: "STATUS_TRIGGERED",
        status: "sleep",
        successful: true,
        preventedAction: true,
        targetRole: actor,
        targetPokemonId: fighter.id,
        targetPokemonName: fighter.name,
        sourcePokemonId: sleepingStatus.sourcePokemonId || null,
        sourcePokemonName: sleepingStatus.sourcePokemonName || null,
        moveId: sleepingStatus.sourceMoveId || null,
        moveName: sleepingStatus.sourceMoveName || null,
      },
    ];
    if (fighter.status.turns <= 0) {
      fighter.status = null;
      statusEvents.push({
        type: "STATUS_EXPIRED",
        status: "sleep",
        successful: true,
        targetRole: actor,
        targetPokemonId: fighter.id,
        targetPokemonName: fighter.name,
      });
    }
    next.turn = enemy;
    next.log = `${fighter.name} continua dormindo e não pode atacar neste turno.`;
    next.effect = {
      kind: "status",
      actor,
      target: actor,
      status: "sleep",
      statusEvents,
      statusEvent: statusEvents[statusEvents.length - 1],
    };
    next.revision += 1;
    return next;
  }
  if (
    fighter.status?.id === "paralysis" &&
    nextRandom(next) < PARALYSIS_ACTION_BLOCK_CHANCE
  ) {
    next.turn = enemy;
    next.log = `${fighter.name} está paralisado e não conseguiu agir!`;
    const statusEvent = {
      type: "STATUS_TRIGGERED",
      status: "paralysis",
      successful: true,
      preventedAction: true,
      targetRole: actor,
      targetPokemonId: fighter.id,
      targetPokemonName: fighter.name,
      sourcePokemonId: fighter.status.sourcePokemonId || null,
      sourcePokemonName: fighter.status.sourcePokemonName || null,
      moveId: fighter.status.sourceMoveId || null,
      moveName: fighter.status.sourceMoveName || null,
    };
    next.effect = {
      kind: "status",
      actor,
      target: actor,
      status: "paralysis",
      statusEvents: [statusEvent],
      statusEvent,
    };
    next.revision += 1;
    return next;
  }
  if (nextRandom(next) > (move.accuracy ?? 100) / 100) {
    next.turn = enemy;
    next.log = `${fighter.name} errou ${move.name}!`;
    next.effect = {
      kind: "miss",
      actor,
      target: enemy,
      type: move.type,
      moveId: move.id,
      moveName: move.name,
      sourcePokemonId: fighter.id,
      sourcePokemonName: fighter.name,
      targetPokemonId: defender.id,
      targetPokemonName: defender.name,
    };
    next.revision += 1;
    return next;
  }
  const attackType = move.type === "own" ? fighter.type : move.type;
  const resolution = calculateDamage({
    attacker: fighter,
    defender,
    move,
    variance:
      1 -
      DAMAGE_BALANCE.VARIANCE +
      nextRandom(next) * DAMAGE_BALANCE.VARIANCE * 2,
  });
  const eventId =
    action.actionId ||
    `${actor}:${state.revision + 1}:${fighter.id}:${defender.id}:${move.id}`;
  const beforeHp = defender.hp;
  let damage = Math.min(beforeHp, resolution.damage);
  const effect = {
    kind: "attack",
    actor,
    target: enemy,
    type: attackType,
    damage,
    effective: resolution.effectiveness > 1,
    special: move.special,
    moveId: move.id,
    moveName: move.name,
    sourcePokemonId: fighter.id,
    sourcePokemonName: fighter.name,
    targetPokemonId: defender.id,
    targetPokemonName: defender.name,
    damageResolution: resolution,
    itemEvents: [],
    statusEvents: [],
  };
  for (const trigger of resolution.itemTriggers) {
    if (trigger.temporary) {
      const owner = trigger.temporary === "barrier" ? defender : fighter;
      delete owner.temporaryEffects[trigger.temporary];
      addItemEvent(effect, {
        itemId: trigger.itemId,
        pokemonId: owner.id,
        targetPokemonId: owner.id,
        consumed: false,
        eventId,
        effect: { type: "damage_multiplier", multiplier: trigger.multiplier },
      });
    }
    if (trigger.consumed) {
      const owner = trigger.owner === "defender" ? defender : fighter;
      const ownerRole = trigger.owner === "defender" ? enemy : actor;
      addItemEvent(effect, {
        ...consumeHeld(owner, trigger.itemId, eventId, {
          type: "damage_multiplier",
          multiplier: trigger.multiplier,
        }, ownerRole),
        owner: ownerRole,
      });
    }
  }
  const lethalItem = heldItemId(defender.heldItem);
  let surviveHp = null;
  if (
    damage >= beforeHp &&
    ["survival-amulet", "phoenix-heart"].includes(lethalItem) &&
    beforeHp > 0
  ) {
    const phoenixRules = HELD_ITEM_DEFINITIONS["phoenix-heart"]?.rules;
    if (lethalItem === "phoenix-heart") {
      defender.temporaryEffects.phoenix = true;
      surviveHp = Math.max(
        1,
        Math.min(
          defender.maxHp,
          Math.ceil(defender.maxHp * (phoenixRules?.healPercent ?? 0.6)),
        ),
      );
    } else surviveHp = 1;
    damage = Math.max(0, beforeHp - Math.min(surviveHp, beforeHp));
    addItemEvent(effect, {
      ...consumeHeld(defender, lethalItem, eventId, {
        type: "survive",
        hp: surviveHp,
        nextAttackMultiplier:
          lethalItem === "phoenix-heart"
            ? (phoenixRules?.multiplier ?? 1.25)
            : null,
      }, enemy),
      owner: enemy,
    });
  }
  if (move.special) fighter.specialAttackUsesRemaining -= 1;
  defender.hp = Math.max(0, beforeHp - damage);
  if (surviveHp != null) defender.hp = surviveHp;
  effect.damage = damage;
  let status = null;
  let reactiveAbility = null;
  if (!defender.status && defender.hp > 0 && move.statusEffect) {
    const successful = nextRandom(next) < move.statusEffect.chance;
    if (successful)
      status = applySupportedStatus(
        defender,
        move.statusEffect.id,
        {
          sourcePokemon: fighter,
          sourceRole: actor,
          targetRole: enemy,
          sourceKind: "move",
          move,
          chance: move.statusEffect.chance,
          appliedTurn: state.revision + 1,
        },
        effect,
        eventId,
      );
    else
      addStatusEvent(effect, {
        type: "STATUS_ATTEMPTED",
        status: move.statusEffect.id,
        successful: false,
        sourceKind: "move",
        sourcePokemonId: fighter.id,
        sourcePokemonName: fighter.name,
        sourceRole: actor,
        targetPokemonId: defender.id,
        targetPokemonName: defender.name,
        targetRole: enemy,
        moveId: move.id,
        moveName: move.name,
        chance: move.statusEffect.chance,
        eventId,
      });
  }
  if (
    defender.ability === "static" &&
    move.damageClass === "physical" &&
    nextRandom(next) < 0.2
  ) {
    const applied = applySupportedStatus(
      fighter,
      "paralysis",
      {
        sourcePokemon: defender,
        sourceRole: enemy,
        targetRole: actor,
        sourceKind: "ability",
        abilityId: "static",
        chance: 0.2,
        appliedTurn: state.revision + 1,
      },
      effect,
      eventId,
    );
    status = applied || status;
    if (applied) reactiveAbility = "static";
  }
  if (
    damage > 0 &&
    activeItem(defender, "poison-thorn") &&
    nextRandom(next) < 0.2
  ) {
    const poisoned = applySupportedStatus(
      fighter,
      "poison",
      {
        sourcePokemon: defender,
        sourceRole: enemy,
        targetRole: actor,
        sourceKind: "item",
        itemId: "poison-thorn",
        chance: 0.2,
        appliedTurn: state.revision + 1,
      },
      effect,
      eventId,
    );
    if (poisoned) {
      status = poisoned;
      addItemEvent(effect, {
        itemId: "poison-thorn",
        pokemonId: defender.id,
        targetPokemonId: fighter.id,
        consumed: false,
        eventId,
        effect: { type: "status", status: "poison" },
      });
    }
  }
  if (damage > 0 && activeItem(fighter, "vampiric-crystal") && fighter.hp > 0) {
    const amount = heal(fighter, damage * 0.05);
    if (amount)
      addItemEvent(effect, {
        itemId: "vampiric-crystal",
        pokemonId: fighter.id,
        targetPokemonId: fighter.id,
        consumed: false,
        eventId,
        effect: { type: "heal_hp", amount },
      });
  }
  const automatic = resolveHeldItemEvent({
    trigger: HELD_ITEM_TRIGGER.AFTER_DAMAGE_RECEIVED,
    owner: defender,
    targetPokemonId: defender.id,
    sourcePokemonId: fighter.id,
    eventId,
    ownerRole: enemy,
    processedEventIds: next.resolvedItemEventIds || [],
  });
  if (automatic) addItemEvent(effect, { ...automatic, owner: enemy });
  effect.status = status;
  effect.ability =
    resolution.percentage > 0 && abilityBonus(fighter, attackType) > 1
      ? fighter.ability
      : reactiveAbility;
  effect.amplifier = resolution.heldItemBonus;
  next.effect = effect;
  next.resolvedItemEventIds = [
    ...(next.resolvedItemEventIds || []),
    eventId,
  ].slice(-100);
  next.log =
    resolution.effectiveness > 1
      ? "SUPER EFETIVO!"
      : `${fighter.name} usou ${move.name}!`;
  if (defender.hp === 0) {
    const replacement = next[enemy].team.findIndex((pokemon) => pokemon.hp > 0);
    if (replacement === -1) {
      next.status = "finished";
      next.winner = actor;
      next.performance.endedAt = Date.now();
      next.log = `${defender.name} desmaiou!`;
    } else {
      next[enemy].active = replacement;
      next.performance.players[enemy].hasSwitched = true;
      next.log = `${defender.name} desmaiou! Vai, ${next[enemy].team[replacement].name}!`;
      next.turn = enemy;
    }
  } else {
    finishActorTurn(next, actor, effect);
    if (fighter.hp <= 0) {
      const replacement = next[actor].team.findIndex(
        (pokemon) => pokemon.hp > 0,
      );
      if (replacement === -1) {
        next.status = "finished";
        next.winner = enemy;
        next.performance.endedAt = Date.now();
      } else {
        next[actor].active = replacement;
        next.performance.players[actor].hasSwitched = true;
      }
    }
    if (next.status !== "finished") next.turn = enemy;
  }
  next.revision += 1;
  return next;
}
