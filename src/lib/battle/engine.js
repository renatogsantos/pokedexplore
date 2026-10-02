import {
  BAG_ITEM_CATALOG,
  getItemDefinition,
  migrateLegacyItemId,
} from "@/lib/items/catalog";
import {
  isSupportedStatus,
  normalizeStatusEffect,
} from "@/lib/battle/statuses";
import {
  getContactAbilityRule,
  getContactAbilityPreview,
  getContactRecoilRule,
  getDamageModifiers,
  getDamageAbilityRule,
  getEndTurnAbilityRule,
  getEnterAbilityRule,
  getStatusPreventionRule,
  getSupportedAbility as getCatalogAbility,
  normalizeAbilityId,
} from "@/lib/battle/abilities";

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
export const MOMENTUM_CONFIG = Object.freeze({
  MAX: 3,
  BONUS_PER_STACK: 0.1,
});
export const MAX_POTIONS = 2; // compatibility only; Bag stock now comes from inventory.
export const MAX_HEALS_PER_POKEMON = 3;
export const MAX_BAG_ITEM_USES_PER_POKEMON = 5;
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
  // Compress the HP contribution so high-HP Pokemon gain meaningful
  // survivability without making low-HP Pokemon unusable.
  HP_REFERENCE: 100,
  HP_DAMAGE_WEIGHT: 0.55,
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
const KNOWN_CONTACT_MOVES = new Set([
  "Tackle",
  "Quick Attack",
  "Fire Fang",
  "Aqua Tail",
  "Vine Whip",
  "Spark",
  "Ice Fang",
  "Karate Chop",
  "Brick Break",
  "Close Combat",
  "Poison Sting",
  "Bulldoze",
  "Peck",
  "Wing Attack",
  "Bug Bite",
  "X-Scissor",
  "Astonish",
  "Shadow Sneak",
  "Dragon Claw",
  "Bite",
  "Assurance",
  "Metal Claw",
  "Iron Head",
  "Draining Kiss",
]);
// Canonical move families used by ability rules. Custom/PokÃ©API moves may
// provide `traits` directly; this local table is the safe fallback for the
// curated battle move pool and never guesses from UI text.
const MOVE_TRAITS = Object.freeze({
  "Bullet Punch": ["PUNCH"], "Comet Punch": ["PUNCH"], "Dizzy Punch": ["PUNCH"], "Drain Punch": ["PUNCH"], "Dynamic Punch": ["PUNCH"], "Fire Punch": ["PUNCH"], "Focus Punch": ["PUNCH"], "Hammer Arm": ["PUNCH"], "Ice Punch": ["PUNCH"], "Mach Punch": ["PUNCH"], "Mega Punch": ["PUNCH"], "Meteor Mash": ["PUNCH"], "Power-Up Punch": ["PUNCH"], "Shadow Punch": ["PUNCH"], "Sky Uppercut": ["PUNCH"], "Thunder Punch": ["PUNCH"],
  Bite: ["BITE"], "Bug Bite": ["BITE"], "Crunch": ["BITE"], "Fire Fang": ["BITE"], "Hyper Fang": ["BITE"], "Ice Fang": ["BITE"], "Poison Fang": ["BITE"], "Psychic Fangs": ["BITE"], "Super Fang": ["BITE"], "Thunder Fang": ["BITE"],
});
export const MOVE_ROLE = Object.freeze({ FAST: "FAST", TECHNICAL: "TECHNICAL", SPECIAL: "SPECIAL" });
const normalizeMoveRole = (move, fallback = MOVE_ROLE.FAST) =>
  move?.special ? MOVE_ROLE.SPECIAL : Object.values(MOVE_ROLE).includes(move?.role) ? move.role : fallback;
export const getMomentumMultiplier = (fighter, move) =>
  normalizeMoveRole(move) === MOVE_ROLE.TECHNICAL
    ? 1 + Math.min(MOMENTUM_CONFIG.MAX, Math.max(0, Number(fighter?.momentum) || 0)) * MOMENTUM_CONFIG.BONUS_PER_STACK
    : 1;
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
    makesContact: true,
    special: false,
  },
  {
    id: "type-strike",
    name: "Golpe de tipo",
    type: "own",
    power: 70,
    accuracy: 100,
    damageClass: "special",
    makesContact: false,
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
const validDurableSnapshot = (fighter, slot, itemId) => {
  if (getItemDefinition(itemId)?.lifecycle !== "DURABLE" || !fighter?.equipmentVersion) return true;
  const copy = fighter.equipmentDurability?.[slot];
  const instanceId = slot === "STRATEGIC" ? fighter.strategicItemInstanceId : fighter.elementalRelicInstanceId;
  return Boolean(copy?.instanceId === instanceId && copy.itemId === itemId && copy.durability > 0);
};
const activeItem = (fighter, id) => heldItemId(fighter?.heldItem) === id && validDurableSnapshot(fighter, "STRATEGIC", id);
const activeRelic = (fighter) => {
  const definition = getItemDefinition(heldItemId(fighter?.elementalRelic));
  return definition?.equipmentSlot === "ELEMENTAL_RELIC" && validDurableSnapshot(fighter, "ELEMENTAL_RELIC", definition.id) ? definition : null;
};
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
  fighter.strategicItem = null;
  return {
    type: "ITEM_CONSUMED",
    itemId,
    pokemonId: fighter.id,
    targetPokemonId: fighter.id,
    eventId,
    owner,
    equipmentSlot: "STRATEGIC",
    effect,
    consumed: true,
  };
};
const addItemEvent = (effect, event) => {
  if (!event) return;
  effect.itemEvents = [...(effect.itemEvents || []), event];
  if (event.consumed && !effect.heldItem) effect.heldItem = event;
  if (process.env.NODE_ENV !== "production" && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugBattle") === "1")
    console.debug("[ITEM TRACE]", { itemId: event.itemId, owner: event.owner || null, pokemonId: event.pokemonId || null, targetPokemonId: event.targetPokemonId || null, effect: event.effect || null, consumed: Boolean(event.consumed), eventId: event.eventId || null });
};
const addStatusEvent = (effect, event) => {
  if (!event) return;
  effect.statusEvents = [...(effect.statusEvents || []), event];
  effect.statusEvent = event;
};
const addAbilityEvent = (effect, event) => {
  if (!event) return;
  effect.abilityEvents = [...(effect.abilityEvents || []), event];
  effect.abilityEvent = event;
};
const addFaintEvent = (effect, { pokemon, owner, source, eventId, cause = "damage" }) => {
  if (!pokemon || pokemon.hp > 0) return;
  effect.faintEvents = [...(effect.faintEvents || []), {
    type: "FAINT",
    eventId,
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    owner,
    sourcePokemonId: source?.id || null,
    sourcePokemonName: source?.name || null,
    cause,
    finalHp: pokemon.hp,
  }];
};
const addMomentumEvent = (effect, event) => {
  if (!event) return;
  effect.momentumEvents = [...(effect.momentumEvents || []), event];
  effect.momentumEvent = event;
};
const abilityEvent = ({
  ability,
  trigger,
  owner,
  source,
  target,
  eventId,
  effect = {},
}) => ({
  type: "ABILITY_ACTIVATED",
  eventId,
  abilityId: ability.id,
  abilityName: ability.namePtBr,
  trigger,
  ownerPokemonId: owner?.id || null,
  ownerPokemonName: owner?.name || null,
  sourcePokemonId: source?.id || null,
  sourcePokemonName: source?.name || null,
  targetPokemonId: target?.id || null,
  targetPokemonName: target?.name || null,
  effect,
});

function applyEnterAbility(next, ownerRole, opponentRole, effect, eventId) {
  const owner = next[ownerRole].team[next[ownerRole].active];
  const opponent = next[opponentRole].team[next[opponentRole].active];
  const definition = getEnterAbilityRule(owner);
  if (!definition || !opponent || opponent.hp <= 0) return;
  applyStatStageChange(opponent, owner, opponentRole, ownerRole, "attack", definition.rule.stages, effect, eventId);
  addAbilityEvent(
    effect,
    abilityEvent({
      ability: definition,
      trigger: "ON_ENTER_BATTLE",
      owner,
      source: owner,
      target: opponent,
      eventId,
      effect: {
        type: "stat_stage",
        stat: "attack",
        stages: definition.rule.stages,
      },
    }),
  );
}

function applyStatStageChange(target, source, targetRole, sourceRole, stat, stages, effect, eventId) {
  target.temporaryEffects.statStages ||= {};
  target.temporaryEffects.statStages[stat] = Math.max(-6, Math.min(6, (target.temporaryEffects.statStages[stat] || 0) + stages));
  if (stages >= 0 || !source || sourceRole === targetRole) return;
  const response = getCatalogAbility(target.abilityId || target.ability);
  if (!response?.rule?.reactsToStatDrop || target.hp <= 0) return;
  const responseStat = response.rule.stat;
  target.temporaryEffects.statStages[responseStat] = Math.min(6, (target.temporaryEffects.statStages[responseStat] || 0) + response.rule.stages);
  addAbilityEvent(effect, abilityEvent({ ability: response, trigger: "ON_STAT_LOWERED", owner: target, source, target, eventId: `${eventId}:${response.id}`, effect: { type: "stat_stage", stat: responseStat, stages: response.rule.stages } }));
}

function applySynchronize(
  effect,
  target,
  source,
  targetRole,
  sourceRole,
  eventId,
  turn,
) {
  const definition = getCatalogAbility(target?.abilityId || target?.ability);
  const applied = (effect.statusEvents || []).find(
    (event) =>
      event.type === "STATUS_APPLIED" &&
      event.targetPokemonId === target.id &&
      definition?.rule.statuses?.includes(event.status),
  );
  if (!definition || !applied || source.status || source.hp <= 0) return;
  const reflected = applySupportedStatus(
    source,
    applied.status,
    {
      sourcePokemon: target,
      sourceRole: targetRole,
      targetRole: sourceRole,
      sourceKind: "ability",
      abilityId: definition.id,
      chance: 1,
      appliedTurn: turn,
    },
    effect,
    eventId,
  );
  if (reflected)
    addAbilityEvent(
      effect,
      abilityEvent({
        ability: definition,
        trigger: "ON_STATUS_APPLIED",
        owner: target,
        source: target,
        target: source,
        eventId,
        effect: { type: "reflect_status", status: reflected },
      }),
    );
}

export const getSupportedAbility = getCatalogAbility;
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
    // Unknown legacy/custom moves must never infer contact from damage class.
    makesContact:
      normalized.makesContact === true ||
      KNOWN_CONTACT_MOVES.has(normalized.name),
    statusEffect: normalizeStatusEffect(normalized),
    traits: Array.from(new Set([...(Array.isArray(normalized.traits) ? normalized.traits : []), ...(MOVE_TRAITS[normalized.name] || [])])),
    role: normalizeMoveRole(normalized, fallback.role),
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
      makesContact: true,
      special: false,
      role: MOVE_ROLE.FAST,
    },
    {
      id: `${type}-steady`,
      type,
      power: 60,
      accuracy: 100,
      damageClass: "physical",
      makesContact: true,
      special: false,
      role: MOVE_ROLE.TECHNICAL,
    },
    {
      id: `${type}-special`,
      type,
      power: 90,
      accuracy: 100,
      damageClass: "special",
      makesContact: false,
      special: true,
      role: MOVE_ROLE.SPECIAL,
    },
  ];
  return definitions.map((definition, index) =>
    normalizeBattleMove(definition, slots[index]),
  );
}

function prepareFighter(pokemon) {
  const validEquipment = (itemId, slot) => validDurableSnapshot(pokemon, slot, itemId) ? itemId : null;
  pokemon = { ...pokemon,
    heldItem: validEquipment(pokemon.heldItem, "STRATEGIC", pokemon.strategicItemInstanceId),
    strategicItem: validEquipment(pokemon.strategicItem || pokemon.heldItem, "STRATEGIC", pokemon.strategicItemInstanceId),
    elementalRelic: validEquipment(pokemon.elementalRelic, "ELEMENTAL_RELIC", pokemon.elementalRelicInstanceId),
  };
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
        .map((entry, index) => normalizeBattleMove(entry, { role: [MOVE_ROLE.FAST, MOVE_ROLE.TECHNICAL, MOVE_ROLE.SPECIAL][index] || MOVE_ROLE.TECHNICAL }))
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
    strategicItem: heldItemId(pokemon.strategicItem || pokemon.heldItem),
    elementalRelic: heldItemId(pokemon.elementalRelic),
    abilityId: normalizeAbilityId(pokemon.abilityId || pokemon.ability),
    ability: normalizeAbilityId(pokemon.abilityId || pokemon.ability),
    specialAttackUsesRemaining: MAX_SPECIAL_ATTACK_USES,
    momentum: 0,
    healsUsed: 0,
    bagUsage: { total: 0, byItem: {} },
    temporaryEffects: {},
  };
}

export function getBagItemUsageLimit(definition) {
  const configured = Number(definition?.battleUsage?.maxPerPokemon);
  if (Number.isInteger(configured) && configured > 0) return configured;
  if (definition?.usageType === "BAG" && process.env.NODE_ENV !== "production")
    console.warn(`[battle] Bag item ${definition?.id || "unknown"} is missing battleUsage.maxPerPokemon; using safe limit 1.`);
  return 1;
}

export function getBagItemUsage(pokemon, itemOrId) {
  const definition = typeof itemOrId === "string" ? getItemDefinition(itemOrId) : itemOrId;
  const itemId = definition?.id;
  const usage = pokemon?.bagUsage || {};
  const itemUsed = Math.max(0, Number(usage.byItem?.[itemId]) || 0);
  return {
    itemUsed,
    itemLimit: getBagItemUsageLimit(definition),
    totalUsed: Math.max(0, Number(usage.total) || 0),
    totalLimit: MAX_BAG_ITEM_USES_PER_POKEMON,
  };
}

export function getBagItemUseBlockReason(pokemon, itemOrId, { activeTarget = true } = {}) {
  const definition = typeof itemOrId === "string" ? getItemDefinition(itemOrId) : itemOrId;
  if (!definition || definition.usageType !== "BAG") return "INVALID_ITEM";
  if (!pokemon || pokemon.hp <= 0) return "TARGET_FAINTED";
  const usage = getBagItemUsage(pokemon, definition);
  if (usage.totalUsed >= usage.totalLimit) return "BAG_LIMIT_REACHED";
  if (usage.itemUsed >= usage.itemLimit) return "ITEM_LIMIT_REACHED";
  if (definition.effectType === "BAG_HEAL") {
    if (pokemon.hp >= pokemon.maxHp) return "HP_FULL";
    if (pokemon.healsUsed >= MAX_HEALS_PER_POKEMON) return "HEAL_LIMIT_REACHED";
  }
  if (definition.effectType === "BAG_CURE" && !pokemon.status) return "NO_STATUS";
  if (definition.effectType === "BAG_BARRIER") {
    if (!activeTarget) return "ACTIVE_POKEMON_REQUIRED";
    if (pokemon.temporaryEffects?.barrier) return "BARRIER_ACTIVE";
  }
  if (definition.effectType === "BAG_STIMULANT") {
    if (!activeTarget) return "ACTIVE_POKEMON_REQUIRED";
    if (pokemon.temporaryEffects?.stimulant) return "STIMULANT_ACTIVE";
  }
  if (definition.effectType === "BAG_RECHARGE" && pokemon.specialAttackUsesRemaining >= MAX_SPECIAL_ATTACK_USES)
    return "SPECIAL_FULL";
  if (["BAG_RUIN", "BAG_TIME_BOMB", "BAG_HUNTER_MARK", "BAG_SILENCE", "BAG_ANCHOR"].includes(definition.effectType) && !activeTarget)
    return "ENEMY_ACTIVE_REQUIRED";
  if (definition.effectType === "BAG_REFLECT_SHIELD" && (!activeTarget || pokemon.temporaryEffects?.reflectShield))
    return activeTarget ? "REFLECT_SHIELD_ACTIVE" : "ACTIVE_POKEMON_REQUIRED";
  if (definition.effectType === "BAG_OVERLOAD" && (!activeTarget || pokemon.temporaryEffects?.overload))
    return activeTarget ? "OVERLOAD_ACTIVE" : "ACTIVE_POKEMON_REQUIRED";
  return null;
}
function statStageMultiplier(stage = 0) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}
export function getMovePowerFactor(power = 40, special = false) {
  const base =
    power <= 40
      ? 0.13
      : power <= 60
        ? 0.18
        : power <= 80
          ? 0.21
          : power <= 100
            ? 0.24
            : 0.27;
  return base * (special ? 1.25 : 1);
}

export function getEffectiveDamageHp(maxHp = DAMAGE_BALANCE.HP_REFERENCE) {
  const hp = Math.max(1, Number(maxHp) || DAMAGE_BALANCE.HP_REFERENCE);
  return DAMAGE_BALANCE.HP_REFERENCE +
    (hp - DAMAGE_BALANCE.HP_REFERENCE) * DAMAGE_BALANCE.HP_DAMAGE_WEIGHT;
}

export function calculateDamage({ attacker, defender, move, variance = 1 }) {
  const attackType = move.type === "own" ? attacker.type : move.type;
  const attackStat = move.damageClass === "special" ? "specialAttack" : "attack";
  const defenseStat = move.damageClass === "special" ? "specialDefense" : "defense";
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
    Math.max(
      DAMAGE_BALANCE.MIN_ATTACK_RATIO,
      (attack * statStageMultiplier(attacker.temporaryEffects?.statStages?.[attackStat] || 0)) /
        Math.max(1, defense * statStageMultiplier(defender.temporaryEffects?.statStages?.[defenseStat] || 0)),
    ),
  );
  const levelFactor = Math.min(
    1.2,
    Math.max(0.85, 1 + ((attacker.level || 1) - (defender.level || 1)) * 0.025),
  );
  const effectiveness = getTypeEffectiveness(attackType, defender);
  const abilityModifiers = getDamageModifiers({ attacker, defender, move, attackType, effectiveness, attackerHpRatio: hpRatio(attacker), defenderHpRatio: hpRatio(defender) });
  const adaptability = abilityModifiers.outgoing.find((entry) => entry.kind === "stab");
  const stab = attacker.types.includes(attackType) ? (adaptability?.multiplier || DAMAGE_BALANCE.STAB) : 1;
  const special = Boolean(move.special);
  const minimum = special
    ? DAMAGE_BALANCE.SPECIAL_MIN
    : DAMAGE_BALANCE.REGULAR_MIN;
  const maximum = special
    ? DAMAGE_BALANCE.SPECIAL_MAX
    : DAMAGE_BALANCE.REGULAR_MAX;
  const abilityRule = getDamageAbilityRule({
    attacker,
    defender,
    attackType,
    hpRatio: hpRatio(attacker),
  });
  let outgoing = abilityRule?.kind === "boost" ? abilityRule.multiplier : 1;
  let incoming = 1;
  const momentumMultiplier = getMomentumMultiplier(attacker, move);
  outgoing *= momentumMultiplier;
  for (const modifier of abilityModifiers.outgoing) if (modifier.kind !== "stab") outgoing *= modifier.multiplier;
  for (const modifier of abilityModifiers.incoming) incoming *= modifier.multiplier;
  const itemTriggers = [];
  const relic = activeRelic(attacker);
  if (relic && attacker.types.includes(relic.elementalType) && attackType === relic.elementalType) {
    let multiplier = Number(relic.rules?.baseMultiplier) || 1;
    let temporary = null;
    if (relic.id === "brasa-primordial" && hpRatio(attacker) <= relic.rules.lowHpRatio) multiplier = relic.rules.lowHpMultiplier;
    if (relic.id === "condutor-de-tempestade" && defender.status?.id === relic.rules.status) multiplier = relic.rules.statusMultiplier;
    if (relic.id === "faixa-do-tita" && move.makesContact && hpRatio(attacker) <= relic.rules.lowHpRatio) multiplier = relic.rules.contactMultiplier;
    if (relic.id === "nucleo-sismico" && attacker.temporaryEffects?.relicSwitchAttack) {
      multiplier = relic.rules.switchInMultiplier;
      temporary = "relicSwitchAttack";
    }
    if (relic.id === "prisma-mental" && normalizeMoveRole(move) === MOVE_ROLE.TECHNICAL && (attacker.momentum || 0) >= MOMENTUM_CONFIG.MAX) multiplier += relic.rules.technicalMomentumBonus || 0;
    if (relic.id === "escama-draconica" && defender.types?.includes(relic.rules.opponentType)) multiplier = relic.rules.opponentMultiplier;
    if (relic.id === "orbe-sombrio" && defender.status) multiplier = relic.rules.targetStatusMultiplier;
    if (relic.id === "cristal-feerico" && defender.types?.includes(relic.rules.opponentType)) multiplier = relic.rules.opponentMultiplier;
    if (relic.id === "simbolo-primordial" && effectiveness === 1) multiplier = relic.rules.neutralMultiplier;
    outgoing *= multiplier;
    itemTriggers.push({ itemId: relic.id, equipmentSlot: "ELEMENTAL_RELIC", consumed: false, multiplier, temporary, owner: "attacker" });
  }
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
  if (attacker.temporaryEffects?.fury) {
    const multiplier = attacker.temporaryEffects.fury.dealtMultiplier;
    outgoing *= multiplier;
    itemTriggers.push({ itemId: "cristal-da-furia", temporary: "fury", multiplier, owner: "attacker" });
  }
  if (defender.temporaryEffects?.hunterMark) {
    const multiplier = defender.temporaryEffects.hunterMark.multiplier;
    outgoing *= multiplier;
    itemTriggers.push({ itemId: "marca-do-cacador", temporary: "hunterMark", multiplier, owner: "attacker" });
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
  if (defender.temporaryEffects?.reflectShield) {
    const multiplier = defender.temporaryEffects.reflectShield.multiplier;
    incoming *= multiplier;
    itemTriggers.push({ itemId: "escudo-refletor", temporary: "reflectShield", multiplier, owner: "defender" });
  }
  if (defender.temporaryEffects?.overload) incoming *= defender.temporaryEffects.overload.receivedMultiplier;
  if (defender.temporaryEffects?.fury) incoming *= defender.temporaryEffects.fury.receivedMultiplier;
  const defenderRelic = activeRelic(defender);
  if (defenderRelic && defender.types.includes(defenderRelic.elementalType)) {
    let multiplier = 1;
    let temporary = null;
    if (defenderRelic.id === "perola-abissal" && hpRatio(defender) <= defenderRelic.rules.lowHpRatio) multiplier = defenderRelic.rules.incomingMultiplier;
    if (defenderRelic.id === "coracao-glacial" && effectiveness > 1) multiplier = defenderRelic.rules.superEffectiveIncomingMultiplier;
    if (defenderRelic.id === "pluma-celeste" && defender.temporaryEffects?.relicSwitchDefense) {
      multiplier = defenderRelic.rules.switchInIncomingMultiplier;
      temporary = "relicSwitchDefense";
    }
    if (defenderRelic.id === "fragmento-colossal" && defender.hp === defender.maxHp) multiplier = defenderRelic.rules.fullHpIncomingMultiplier;
    if (defenderRelic.id === "liga-arcana" && effectiveness > 1) multiplier = defenderRelic.rules.superEffectiveIncomingMultiplier;
    if (defenderRelic.id === "casulo-ancestral" && defender.temporaryEffects?.relicEntryGuard) {
      multiplier = defenderRelic.rules.incomingMultiplier;
      temporary = "relicEntryGuard";
    }
    if (multiplier !== 1) { incoming *= multiplier; itemTriggers.push({ itemId: defenderRelic.id, equipmentSlot: "ELEMENTAL_RELIC", consumed: false, multiplier, temporary, owner: "defender" }); }
  }
  const movePowerFactor = getMovePowerFactor(move.power, special);
  const rawBasePercentage =
    movePowerFactor * ratio * levelFactor * stab * effectiveness * variance;
  const basePercentage = Math.min(
    maximum,
    Math.max(
      minimum,
      rawBasePercentage,
    ),
  );
  const percentage = basePercentage * outgoing * incoming;
  const effectiveDamageHp = getEffectiveDamageHp(defender.maxHp);
  return {
    damage: Math.max(1, Math.round(effectiveDamageHp * percentage)),
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
    damageBreakdown: {
      attackType,
      damageClass: move.damageClass,
      attackStat,
      defenseStat,
      attack,
      defense,
      attackRatio: ratio,
      power: move.power,
      movePowerFactor,
      levelFactor,
      stabMultiplier: stab,
      typeMultiplier: effectiveness,
      abilityMultiplier: (abilityRule?.kind === "boost" ? abilityRule.multiplier : 1) * abilityModifiers.outgoing.filter((entry) => entry.kind !== "stab").reduce((total, entry) => total * entry.multiplier, 1),
      itemMultiplier: outgoing / ((abilityRule?.kind === "boost" ? abilityRule.multiplier : 1) * momentumMultiplier * abilityModifiers.outgoing.filter((entry) => entry.kind !== "stab").reduce((total, entry) => total * entry.multiplier, 1)),
      incomingMultiplier: incoming,
      momentumMultiplier,
      criticalMultiplier: 1,
      variance,
      rawBasePercentage,
      basePercentage,
      finalPercentage: percentage,
      defenderMaxHp: defender.maxHp,
      effectiveDamageHp,
      hpDamageWeight: DAMAGE_BALANCE.HP_DAMAGE_WEIGHT,
    },
    itemTriggers,
    abilityRule,
    abilityModifiers,
    momentum: {
      stacks: Math.min(MOMENTUM_CONFIG.MAX, Math.max(0, Number(attacker?.momentum) || 0)),
      multiplier: momentumMultiplier,
      consumedByMove: normalizeMoveRole(move) === MOVE_ROLE.TECHNICAL,
    },
    heldItemBonus:
      itemTriggers.find(
        (entry) =>
          entry.owner === "attacker" || entry.itemId === "elemental-core",
      ) || null,
  };
}

// Pure preview derived from the authoritative calculateDamage pipeline. It
// never rolls or mutates state, so rendering a move button cannot affect RNG.
export function getDamagePreview({ attacker, defender, move }) {
  const attackType = move?.type === "own" ? attacker?.type : move?.type;
  const resolution = calculateDamage({ attacker, defender, move, variance: 1 });
  const blocked = resolution.abilityRule?.kind === "immunity";
  if (blocked) return { minDamage: 0, maxDamage: 0, expectedDamage: 0, blocked: true, immune: true, resolution };
  const min = calculateDamage({ attacker, defender, move, variance: 1 - DAMAGE_BALANCE.VARIANCE }).damage;
  const max = calculateDamage({ attacker, defender, move, variance: 1 + DAMAGE_BALANCE.VARIANCE }).damage;
  return {
    minDamage: Math.min(defender?.hp ?? min, min),
    maxDamage: Math.min(defender?.hp ?? max, max),
    expectedDamage: Math.min(defender?.hp ?? resolution.damage, resolution.damage),
    blocked: false,
    immune: false,
    attackType,
    resolution,
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
      ...consumeHeld(
        owner,
        definition.id,
        eventId,
        {
          type: "heal_hp",
          amount,
        },
        ownerRole,
      ),
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
      ...consumeHeld(
        owner,
        definition.id,
        eventId,
        {
          type: "regeneration",
          ticks: definition.rules.ticks,
        },
        ownerRole,
      ),
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
  const abilityPrevention = getStatusPreventionRule(target, statusId);
  if (abilityPrevention) {
    addStatusEvent(effect, { ...statusEvent, type: "STATUS_PREVENTED", successful: false, abilityId: abilityPrevention.id });
    addAbilityEvent(effect, abilityEvent({
      ability: abilityPrevention,
      trigger: "STATUS_ATTEMPT",
      owner: target,
      source: context.sourcePokemon,
      target,
      eventId,
      effect: { type: "prevent_status", status: statusId },
    }));
    return null;
  }
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
      ...consumeHeld(
        target,
        prevention,
        eventId,
        {
          type: "prevent_status",
          status: statusId,
          healing: recovery,
        },
        context.targetRole,
      ),
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
      ...consumeHeld(
        target,
        "purifier",
        eventId,
        {
          type: "cure_status",
          status: statusId,
          healing: recovery,
        },
        context.targetRole,
      ),
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

function resolveLethalSurvival({ target, hpBefore, damage, effect, eventId, ownerRole, source }) {
  if (!target || hpBefore <= 0 || damage < hpBefore) return null;
  const sturdy = getCatalogAbility(target.abilityId || target.ability);
  if (hpBefore === target.maxHp && sturdy?.rule?.surviveAtFullHp) {
    addAbilityEvent(effect, abilityEvent({ ability: sturdy, trigger: "BEFORE_FAINT", owner: target, source, target, eventId: `${eventId}:sturdy`, effect: { type: "survive", hp: 1 } }));
    return { hp: 1, preventedBy: "sturdy" };
  }
  const itemId = heldItemId(target.heldItem);
  if (!['survival-amulet', 'phoenix-heart'].includes(itemId)) return null;
  const rules = itemRules(itemId);
  const recoveredHp = itemId === "phoenix-heart"
    ? Math.max(1, Math.min(target.maxHp, Math.ceil(target.maxHp * rules.healPercent)))
    : 1;
  if (!Number.isFinite(recoveredHp)) return null;
  if (itemId === "phoenix-heart") target.temporaryEffects.phoenix = true;
  addItemEvent(effect, {
    ...consumeHeld(target, itemId, eventId, {
      type: "survive",
      hp: recoveredHp,
      hpBefore,
      incomingDamage: damage,
      preventedFaint: true,
      restoredHp: recoveredHp,
      finalHp: recoveredHp,
      nextAttackMultiplier: itemId === "phoenix-heart" ? rules.multiplier : null,
    }, ownerRole),
    owner: ownerRole,
  });
  return { hp: recoveredHp, preventedBy: itemId };
}

function finishActorTurn(next, actor, effect) {
  const fighter = next[actor].team[next[actor].active];
  if (!fighter || fighter.hp <= 0) return;
  if (fighter.status && ["burn", "poison"].includes(fighter.status.id)) {
    const damage = Math.max(
      1,
      Math.ceil(fighter.maxHp * STATUS_DAMAGE_PERCENTAGE),
    );
    const hpBefore = fighter.hp;
    const survival = resolveLethalSurvival({
      target: fighter,
      hpBefore,
      damage,
      effect,
      eventId: `status:${next.revision + 1}:${fighter.id}:${fighter.status.id}`,
      ownerRole: actor,
      source: null,
    });
    fighter.hp = survival?.hp ?? Math.max(0, hpBefore - damage);
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
  for (const [key, itemId] of [["ruin", "fragmento-da-ruina"], ["timeBomb", "bomba-temporal"]]) {
    const pending = fighter.temporaryEffects?.[key];
    if (!pending || fighter.hp <= 0) continue;
    pending.ticks -= 1;
    if (pending.ticks > 0) continue;
    const damage = Math.max(1, Math.ceil(fighter.maxHp * pending.damagePercent));
    const survival = resolveLethalSurvival({ target: fighter, hpBefore: fighter.hp, damage, effect, eventId: `${itemId}:${next.revision + 1}:${fighter.id}`, ownerRole: actor, source: null });
    fighter.hp = survival?.hp ?? Math.max(0, fighter.hp - damage);
    delete fighter.temporaryEffects[key];
    addItemEvent(effect, { itemId, pokemonId: fighter.id, targetPokemonId: fighter.id, consumed: false, eventId: `${itemId}:${next.revision + 1}:${fighter.id}`, effect: { type: "delayed_damage", amount: damage } });
  }
  for (const key of ["hunterMark", "silence", "anchor", "fury"]) {
    const pending = fighter.temporaryEffects?.[key];
    if (!pending?.ticks) continue;
    pending.ticks -= 1;
    if (pending.ticks <= 0) delete fighter.temporaryEffects[key];
  }
  const relic = activeRelic(fighter);
  if (fighter.hp > 0 && relic?.id === "semente-ancestral" && hpRatio(fighter) <= relic.rules.lowHpRatio && (fighter.temporaryEffects.relicHealTicks || 0) < relic.rules.maxTicks) {
    const amount = heal(fighter, fighter.maxHp * relic.rules.endRoundHealPercent);
    if (amount) { fighter.temporaryEffects.relicHealTicks = (fighter.temporaryEffects.relicHealTicks || 0) + 1; addItemEvent(effect, { itemId: relic.id, pokemonId: fighter.id, targetPokemonId: fighter.id, consumed: false, eventId: `relic:${next.revision + 1}:${fighter.id}:heal`, effect: { type: "heal_hp", amount } }); }
  }
  const ability = getEndTurnAbilityRule(fighter);
  if (fighter.hp > 0 && ability) {
    fighter.temporaryEffects.statStages ||= {};
    fighter.temporaryEffects.statStages.speed = Math.min(
      6,
      (fighter.temporaryEffects.statStages.speed || 0) + ability.rule.stages,
    );
    addAbilityEvent(
      effect,
      abilityEvent({
        ability,
        trigger: "END_OF_TURN",
        owner: fighter,
        source: fighter,
        target: fighter,
        eventId: `ability:${next.revision + 1}:${fighter.id}:speed`,
        effect: {
          type: "stat_stage",
          stat: "speed",
          stages: ability.rule.stages,
        },
      }),
    );
  }
}

// Pure decision facts for UI and CPU. It deliberately never rolls RNG,
// changes a fighter, or predicts final damage.
export function analyzeMoveDecision({
  attacker,
  defender,
  move,
  battleState = null,
}) {
  const attackType = move?.type === "own" ? attacker?.type : move?.type;
  const effectiveness = getTypeEffectiveness(attackType, defender);
  const abilityRule = getDamageAbilityRule({
    attacker,
    defender,
    attackType,
    hpRatio: hpRatio(attacker),
  });
  const blockedByAbility = abilityRule?.kind === "immunity";
  const abilityModifiers = getDamageModifiers({ attacker, defender, move, attackType, effectiveness, attackerHpRatio: hpRatio(attacker), defenderHpRatio: hpRatio(defender) });
  const contact = move?.makesContact === true;
  const defenderContactAbility = getContactAbilityPreview(defender);
  const contactPreview =
    contact && !blockedByAbility ? defenderContactAbility : null;
  const contactRecoil = contact && !blockedByAbility ? getContactRecoilRule(defender) : null;
  const preventedStatus = move?.statusEffect ? getStatusPreventionRule(defender, move.statusEffect.id) : null;
  const canReceiveContactStatus =
    !attacker?.status && contactPreview?.statuses?.some(isSupportedStatus);
  const synchronize = getCatalogAbility(
    defender?.abilityId || defender?.ability,
  );
  const synchronizeRisk =
    !blockedByAbility &&
    !attacker?.status &&
    synchronize?.id === "synchronize" &&
    synchronize.rule.statuses?.includes(move?.statusEffect?.id);
  const attackReduced =
    move?.damageClass !== "special" &&
    (attacker?.temporaryEffects?.statStages?.attack || 0) < 0;
  const warnings = [];
  if (blockedByAbility)
    warnings.push({
      kind: "blocked",
      ability: abilityRule.ability,
      detail: abilityRule.healRatio
        ? "Rival pode recuperar HP"
        : abilityRule.activate
          ? "Pode fortalecer o rival"
          : "O golpe não atinge",
    });
  else {
    for (const modifier of abilityModifiers.incoming)
      warnings.push({ kind: "reduced", ability: modifier.ability, multiplier: modifier.multiplier, detail: "DANO REDUZIDO" });
    for (const modifier of abilityModifiers.outgoing)
      warnings.push({ kind: "boost", ability: modifier.ability, multiplier: modifier.multiplier, detail: modifier.kind === "stab" ? "STAB FORTALECIDO" : `+${Math.round((modifier.multiplier - 1) * 100)}% PODER` });
    if (abilityRule?.kind === "boost")
      warnings.push({
        kind: "boost",
        ability: abilityRule.ability,
        multiplier: abilityRule.multiplier,
        detail: `+${Math.round((abilityRule.multiplier - 1) * 100)}% PODER`,
      });
    if (contactPreview && canReceiveContactStatus)
      warnings.push({
        kind: "risk",
        ability: contactPreview.ability,
        statuses: contactPreview.statuses,
        chance: contactPreview.chance,
        detail:
          contactPreview.ability.id === "effect-spore"
            ? "Pode causar status"
            : `Pode causar ${{ poison: "veneno", paralysis: "paralisia", burn: "queimadura" }[contactPreview.statuses[0]] || "status"}`,
      });
    if (contactRecoil) warnings.push({ kind: "risk", ability: contactRecoil.ability, detail: "Contato causa dano em vocÃª" });
    if (preventedStatus) warnings.push({ kind: "blocked", ability: preventedStatus, detail: `NÃ£o pode receber ${move.statusEffect.id}` });
    if (synchronizeRisk)
      warnings.push({
        kind: "risk",
        ability: synchronize,
        detail: "Status pode voltar para você",
      });
    if (attackReduced)
      warnings.push({ kind: "reduced", detail: "ATAQUE REDUZIDO" });
  }
  warnings.sort(
    (left, right) =>
      ({ blocked: 0, risk: 1, boost: 2, reduced: 3 })[left.kind] -
      { blocked: 0, risk: 1, boost: 2, reduced: 3 }[right.kind],
  );
  const primary =
    warnings.find((entry) => entry.kind === "blocked") ||
    warnings.find((entry) => entry.kind === "risk") ||
    warnings.find((entry) => entry.kind === "boost") ||
    (effectiveness > 1
      ? { kind: "positive", detail: "SUPER EFETIVO" }
      : effectiveness < 1
        ? { kind: "weak", detail: "POUCO EFETIVO" }
        : { kind: "neutral", detail: "NORMAL" });
  return {
    attackType,
    effectiveness,
    makesContact: contact,
    contactRelevant: Boolean(defenderContactAbility),
    blockedByAbility: Boolean(blockedByAbility),
    absorbedByAbility: Boolean(abilityRule?.healRatio),
    attackerAbilityBoost: abilityRule?.kind === "boost" ? abilityRule : null,
    contactRisk:
      contactPreview && canReceiveContactStatus ? contactPreview : contactRecoil,
    statusPreventedByAbility: preventedStatus,
    abilityModifiers,
    synchronizeRisk: Boolean(synchronizeRisk),
    attackReduced,
    warnings,
    primary,
    decisionSeverity:
      primary.kind === "blocked"
        ? "BLOCKED"
        : warnings.some((entry) => entry.kind === "risk")
          ? "RISK"
          : primary.kind === "positive" || primary.kind === "boost"
            ? "POSITIVE"
            : "NEUTRAL",
  };
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
      privateBag: Boolean(player.privateBag),
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
  const state = {
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
  const effect = { kind: "battle-start", abilityEvents: [] };
  applyEnterAbility(state, "host", "guest", effect, "battle-start:host");
  applyEnterAbility(state, "guest", "host", effect, "battle-start:guest");
  state.effect = effect.abilityEvents.length ? effect : null;
  return state;
}

function resolveBagAction(state, next, actor, enemy, action) {
  const itemId =
    action.type === "potion"
      ? "vital-potion"
      : migrateLegacyItemId(action.itemId);
  const definition = getItemDefinition(itemId);
  const targetsEnemy = ["ENEMY_ACTIVE", "ENEMY_SIDE"].includes(definition?.battleUsage?.target);
  const targetRole = targetsEnemy ? enemy : actor;
  const targetIndex = next[targetRole].team.findIndex(
    (pokemon) => String(pokemon.id) === String(action.targetPokemonId),
  );
  const target = next[targetRole].team[targetIndex];
  const quantity = next[actor].bag?.[itemId] || 0;
  if (
    !definition ||
    definition.usageType !== "BAG" ||
    !target ||
    (!next[actor].privateBag && !quantity) ||
    target.hp <= 0
  )
    return state;
  const blockReason = getBagItemUseBlockReason(target, definition, {
    activeTarget: targetIndex === next[targetRole].active,
  });
  if (blockReason) return state;
  let healing = 0;
  let curedStatus = null;
  if (definition.effectType === "BAG_HEAL") {
    healing = heal(target, target.maxHp * definition.rules.healPercent);
    if (!healing) return state;
    target.healsUsed += 1;
  } else if (definition.effectType === "BAG_CURE") {
    curedStatus = target.status.id;
    target.status = null;
  } else if (definition.effectType === "BAG_BARRIER") {
    target.temporaryEffects.barrier = true;
  } else if (definition.effectType === "BAG_STIMULANT") {
    target.temporaryEffects.stimulant = true;
  } else if (definition.effectType === "BAG_RECHARGE") {
    target.specialAttackUsesRemaining += 1;
  } else if (definition.effectType === "BAG_RUIN") {
    target.temporaryEffects.ruin = { ticks: definition.rules.rounds, damagePercent: definition.rules.damagePercent, sourceRole: actor };
  } else if (definition.effectType === "BAG_TIME_BOMB") {
    target.temporaryEffects.timeBomb = { ticks: definition.rules.rounds, damagePercent: definition.rules.damagePercent, sourceRole: actor };
  } else if (definition.effectType === "BAG_HUNTER_MARK") {
    target.temporaryEffects.hunterMark = { ticks: definition.rules.rounds, multiplier: definition.rules.multiplier, ownerRole: actor };
  } else if (definition.effectType === "BAG_REFLECT_SHIELD") {
    target.temporaryEffects.reflectShield = { multiplier: definition.rules.mitigationMultiplier, reflectPercent: definition.rules.reflectPercent };
  } else if (definition.effectType === "BAG_STEAL_MOMENTUM") {
    const user = next[actor].team[next[actor].active];
    const amount = Math.min(1, target.momentum || 0);
    target.momentum = Math.max(0, (target.momentum || 0) - amount);
    user.momentum = Math.min(MOMENTUM_CONFIG.MAX, (user.momentum || 0) + amount);
  } else if (definition.effectType === "BAG_SILENCE") {
    target.temporaryEffects.silence = { ticks: definition.rules.rounds, sourceRole: actor };
  } else if (definition.effectType === "BAG_ANCHOR") {
    target.temporaryEffects.anchor = { ticks: definition.rules.rounds, sourceRole: actor };
  } else if (definition.effectType === "BAG_ELEMENTAL_MINE") {
    next[enemy].temporarySideEffects ||= {};
    next[enemy].temporarySideEffects.elementalMine = { damagePercent: definition.rules.damagePercent, sourceRole: actor };
  } else if (definition.effectType === "BAG_OVERLOAD") {
    target.momentum = Math.min(MOMENTUM_CONFIG.MAX, (target.momentum || 0) + (definition.rules.momentum || 0));
    target.temporaryEffects.overload = { receivedMultiplier: definition.rules.receivedMultiplier };
  } else return state;
  const usage = getBagItemUsage(target, definition);
  target.bagUsage = {
    total: usage.totalUsed + 1,
    byItem: { ...(target.bagUsage?.byItem || {}), [itemId]: usage.itemUsed + 1 },
  };
  // A PvP participant's persistent Bag is intentionally private. The host
  // validates shared battle rules and the actor validates local stock before
  // sending intent; only public/CPU inventories live in battle state.
  if (!next[actor].privateBag) next[actor].bag[itemId] = quantity - 1;
  next[actor].potionsRemaining = next[actor].bag["vital-potion"] || 0;
  next.turn = enemy;
  next.log = `${definition.name} usado em ${target.name}!`;
  next.effect = {
    kind: "item",
    type: "ITEM_CONSUMED",
    itemId,
    itemName: definition.name,
    actor,
    target: targetRole,
    targetPokemonId: target.id,
    targetPokemonName: target.name,
    targetIndex,
    healing,
    curedStatus,
    remaining: next[actor].privateBag ? null : next[actor].bag[itemId],
    itemUsageCount: usage.itemUsed + 1,
    itemUsageLimit: usage.itemLimit,
    totalBagUsageCount: usage.totalUsed + 1,
    totalBagUsageLimit: usage.totalLimit,
    eventId:
      action.actionId ||
      `${actor}:${state.revision + 1}:bag:${itemId}:${target.id}`,
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
      itemUsageCount: usage.itemUsed + 1,
      itemUsageLimit: usage.itemLimit,
      totalBagUsageCount: usage.totalUsed + 1,
      totalBagUsageLimit: usage.totalLimit,
    },
  };
  next.revision += 1;
  return next;
}

export function resolveAction(state, actor, action) {
  if (!state || !["host", "guest"].includes(actor) || !action || state.status !== "playing" || state.turn !== actor) return state;
  const enemy = actor === "host" ? "guest" : "host";
  const next = cloneBattleState(state);
  const fighter = next[actor].team[next[actor].active];
  if (!fighter) return state;
  if (action.type === "switch") {
    if (fighter.temporaryEffects?.anchor) return state;
    const incoming = next[actor].team[action.index];
    if (!incoming || incoming.hp <= 0 || action.index === next[actor].active)
      return state;
    const outgoing = fighter;
    const itemId = heldItemId(outgoing.heldItem);
    const effect = { kind: "switch", actor, itemEvents: [], abilityEvents: [] };
    const switchAbility = getCatalogAbility(outgoing.abilityId || outgoing.ability);
    if (switchAbility?.rule?.healRatio && switchAbility.hooks?.includes("ON_SWITCH_OUT")) {
      const amount = heal(outgoing, outgoing.maxHp * switchAbility.rule.healRatio);
      if (amount) addAbilityEvent(effect, abilityEvent({ ability: switchAbility, trigger: "ON_SWITCH_OUT", owner: outgoing, source: outgoing, target: outgoing, eventId: `${action.actionId || `${actor}:${state.revision + 1}:switch`}:regenerator`, effect: { type: "heal_hp", amount } }));
    }
    // Stages are battle-local and leave with the PokÃ©mon; durable data is never mutated.
    outgoing.temporaryEffects.statStages = {};
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
    const incomingRelic = activeRelic(incoming);
    if (incomingRelic?.id === "nucleo-sismico") incoming.temporaryEffects.relicSwitchAttack = true;
    if (incomingRelic?.id === "pluma-celeste") incoming.temporaryEffects.relicSwitchDefense = true;
    if (incomingRelic?.id === "casulo-ancestral" && hpRatio(incoming) <= incomingRelic.rules.entryHpRatio) incoming.temporaryEffects.relicEntryGuard = true;
    const mine = next[actor].temporarySideEffects?.elementalMine;
    if (mine && incoming.hp > 0) {
      const damage = Math.max(1, Math.ceil(incoming.maxHp * mine.damagePercent));
      const mineEventId = `${action.actionId || `${actor}:${state.revision + 1}:switch`}:mine`;
      const survival = resolveLethalSurvival({ target: incoming, hpBefore: incoming.hp, damage, effect, eventId: mineEventId, ownerRole: actor, source: null });
      incoming.hp = survival?.hp ?? Math.max(0, incoming.hp - damage);
      delete next[actor].temporarySideEffects.elementalMine;
      addItemEvent(effect, { itemId: "mina-elemental", pokemonId: incoming.id, targetPokemonId: incoming.id, consumed: false, eventId: mineEventId, effect: { type: "damage", amount: damage } });
      if (incoming.hp <= 0) {
        addFaintEvent(effect, { pokemon: incoming, owner: actor, source: null, eventId: `${mineEventId}:faint:${incoming.id}`, cause: "item" });
        const replacement = next[actor].team.findIndex((pokemon) => pokemon.hp > 0);
        if (replacement === -1) {
          next.status = "finished";
          next.winner = enemy;
          next.performance.endedAt = Date.now();
        } else next[actor].active = replacement;
      }
    }
    next.performance.players[actor].hasSwitched = true;
    if (next.status !== "finished")
      applyEnterAbility(next, actor, enemy, effect, action.actionId || `${actor}:${state.revision + 1}:switch-in`);
    next.turn = enemy;
    next.log = incoming.hp <= 0
      ? `${incoming.name} desmaiou!${next.status === "finished" ? "" : ` Vai, ${next[actor].team[next[actor].active].name}!`}`
      : `Vai, ${incoming.name}!`;
    next.effect = effect;
    next.revision += 1;
    return next;
  }
  if (action.type === "potion" || action.type === "item")
    return resolveBagAction(state, next, actor, enemy, action);
  if (action.type !== "attack" || fighter.hp <= 0) return state;
  const move = fighter.moves.find((entry) => entry.id === action.moveId);
  const defender = next[enemy].team[next[enemy].active];
  if (
    !move ||
    !defender ||
    (move.special && fighter.specialAttackUsesRemaining <= 0)
  )
    return state;
  if (move.special && fighter.temporaryEffects?.silence) {
    delete fighter.temporaryEffects.silence;
    const eventId = action.actionId || `${actor}:${state.revision + 1}:${fighter.id}:silenced`;
    next.turn = enemy;
    next.log = `${fighter.name} teve o golpe Especial selado!`;
    next.effect = {
      kind: "status",
      actor,
      target: actor,
      status: "silence",
      itemEvents: [{
        itemId: "selo-do-silencio",
        pokemonId: fighter.id,
        targetPokemonId: fighter.id,
        consumed: false,
        eventId,
        effect: { type: "special_blocked" },
      }],
    };
    finishActorTurn(next, actor, next.effect, eventId);
    next.revision += 1;
    return next;
  }
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
  const immunity =
    resolution.abilityRule?.kind === "immunity" ? resolution.abilityRule : null;
  let damage = immunity ? 0 : Math.min(beforeHp, resolution.damage);
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
    abilityEvents: [],
    momentumEvents: [],
  };
  let immunityRecovery = 0;
  if (immunity) {
    if (immunity.activate) defender.temporaryEffects.flashFire = true;
    addAbilityEvent(
      effect,
      abilityEvent({
        ability: immunity.ability,
        trigger: "BEFORE_DAMAGE",
        owner: defender,
        source: fighter,
        target: defender,
        eventId,
        effect: {
          type: immunity.activate
            ? "absorb_and_empower"
            : immunity.healRatio
              ? "absorb_and_heal"
              : "immune",
          attackType,
          healing: 0,
          activated: Boolean(immunity.activate),
        },
      }),
    );
    if (immunity.stat && immunity.stages) {
      applyStatStageChange(defender, fighter, enemy, actor, immunity.stat, immunity.stages, effect, `${eventId}:absorb-boost`);
      effect.abilityEvents[effect.abilityEvents.length - 1].effect.stat = immunity.stat;
      effect.abilityEvents[effect.abilityEvents.length - 1].effect.stages = immunity.stages;
    }
  }
  for (const trigger of resolution.itemTriggers) {
    if (trigger.temporary) {
      const owner = trigger.owner === "defender" || trigger.temporary === "barrier" ? defender : fighter;
      if (["barrier", "reflectShield", "stimulant", "phoenix", "impulse", "fury", "relicSwitchAttack", "relicSwitchDefense", "relicEntryGuard"].includes(trigger.temporary)) delete owner.temporaryEffects[trigger.temporary];
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
        ...consumeHeld(
          owner,
          trigger.itemId,
          eventId,
          {
            type: "damage_multiplier",
            multiplier: trigger.multiplier,
          },
          ownerRole,
        ),
        owner: ownerRole,
      });
    }
    if (!trigger.temporary && !trigger.consumed && trigger.itemId) {
      const owner = trigger.owner === "defender" ? defender : fighter;
      addItemEvent(effect, { itemId: trigger.itemId, pokemonId: owner.id, targetPokemonId: owner.id, equipmentSlot: trigger.equipmentSlot || "STRATEGIC", consumed: false, eventId: `${eventId}:${trigger.itemId}`, effect: { type: "damage_multiplier", multiplier: trigger.multiplier } });
    }
  }
  const survival = resolveLethalSurvival({ target: defender, hpBefore: beforeHp, damage, effect, eventId, ownerRole: enemy, source: fighter });
  if (survival) damage = Math.max(0, beforeHp - survival.hp);
  if (move.special) {
    fighter.specialAttackUsesRemaining -= 1;
    if (fighter.specialAttackUsesRemaining === 0 && activeItem(fighter, "ampulheta-quebrada")) {
      fighter.specialAttackUsesRemaining = 1;
      addItemEvent(effect, { ...consumeHeld(fighter, "ampulheta-quebrada", `${eventId}:hourglass`, { type: "restore_special", amount: 1 }, actor), owner: actor });
    }
  }
  defender.hp = Math.max(0, beforeHp - damage);
  if (survival) defender.hp = survival.hp;
  if (damage > 0 && activeItem(defender, "cristal-da-furia") && !defender.temporaryEffects.fury && hpRatio(defender) <= itemRules("cristal-da-furia").hpRatioLTE) {
    defender.temporaryEffects.fury = { ticks: itemRules("cristal-da-furia").rounds, dealtMultiplier: itemRules("cristal-da-furia").dealtMultiplier, receivedMultiplier: itemRules("cristal-da-furia").receivedMultiplier };
    addItemEvent(effect, { itemId: "cristal-da-furia", pokemonId: defender.id, targetPokemonId: defender.id, consumed: false, eventId, effect: { type: "fury_armed", rounds: defender.temporaryEffects.fury.ticks } });
  }
  if (damage > 0 && move.special && activeItem(defender, "espelho-prismatico") && fighter.hp > 0) {
    const reflected = Math.max(1, Math.floor(damage * itemRules("espelho-prismatico").reflectPercent));
    const reflectedSurvival = resolveLethalSurvival({ target: fighter, hpBefore: fighter.hp, damage: reflected, effect, eventId: `${eventId}:prism`, ownerRole: actor, source: defender });
    fighter.hp = reflectedSurvival?.hp ?? Math.max(0, fighter.hp - reflected);
    addItemEvent(effect, { ...consumeHeld(defender, "espelho-prismatico", `${eventId}:prism`, { type: "reflect_damage", amount: reflected }, enemy), owner: enemy });
  }
  const hpAfterDamage = defender.hp;
  if (immunity?.healRatio) {
    immunityRecovery = heal(defender, defender.maxHp * immunity.healRatio);
    if (effect.abilityEvent?.abilityId === immunity.ability.id)
      effect.abilityEvent.effect.healing = immunityRecovery;
    if (effect.abilityEvents?.[0]?.abilityId === immunity.ability.id)
      effect.abilityEvents[0].effect.healing = immunityRecovery;
  }
  effect.damage = damage;
  effect.damageDiagnostic = {
    eventId,
    attacker: fighter.name,
    defender: defender.name,
    move: move.name,
    ...resolution.damageBreakdown,
    hpBefore: beforeHp,
    hpAfterDamage,
    hpAfter: defender.hp,
    damageApplied: damage,
    hpInvariantHolds: beforeHp - hpAfterDamage === damage,
  };
  if (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debugBattle") === "1"
  )
    console.debug("[Battle damage]", effect.damageDiagnostic);
  // Momentum is resolved only by the authoritative action after a successful,
  // non-immune hit. It belongs to the fighter and therefore survives switching.
  const moveRole = normalizeMoveRole(move);
  if (!immunity && damage > 0 && moveRole === MOVE_ROLE.FAST) {
    const before = fighter.momentum || 0;
    fighter.momentum = Math.min(MOMENTUM_CONFIG.MAX, before + 1);
    if (fighter.momentum > before) addMomentumEvent(effect, { type: "MOMENTUM_GAINED", pokemonId: fighter.id, owner: actor, before, after: fighter.momentum, amount: fighter.momentum - before, eventId });
  }
  if (!immunity && damage > 0 && moveRole === MOVE_ROLE.TECHNICAL && (fighter.momentum || 0) > 0) {
    const before = fighter.momentum;
    fighter.momentum = 0;
    addMomentumEvent(effect, { type: "MOMENTUM_CONSUMED", pokemonId: fighter.id, owner: actor, before, after: 0, amount: before, multiplier: getMomentumMultiplier({ momentum: before }, move), eventId });
  }
  let status = null;
  let reactiveAbility = null;
  if (!immunity && !defender.status && defender.hp > 0 && move.statusEffect) {
    const statusRelicBonus = activeRelic(fighter)?.id === "presa-toxica" ? activeRelic(fighter).rules.poisonChanceBonus || 0 : 0;
    const statusChance = Math.min(1, move.statusEffect.chance + (move.statusEffect.id === "poison" ? statusRelicBonus : 0));
    const successful = nextRandom(next) < statusChance;
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
          chance: statusChance,
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
        chance: statusChance,
        eventId,
      });
  }
  const contactRule =
    !immunity && move.makesContact && defender.hp > 0
      ? getContactAbilityRule(defender, nextRandom(next))
      : null;
  if (contactRule) {
    const applied = applySupportedStatus(
      fighter,
      contactRule.status,
      {
        sourcePokemon: defender,
        sourceRole: enemy,
        targetRole: actor,
        sourceKind: "ability",
        abilityId: contactRule.ability.id,
        chance: contactRule.chance,
        appliedTurn: state.revision + 1,
      },
      effect,
      eventId,
    );
    status = applied || status;
    if (applied) {
      reactiveAbility = contactRule.ability.id;
      addAbilityEvent(
        effect,
        abilityEvent({
          ability: contactRule.ability,
          trigger: "AFTER_CONTACT_RECEIVED",
          owner: defender,
          source: defender,
          target: fighter,
          eventId,
          effect: { type: "status", status: applied, makesContact: true },
        }),
      );
    }
  }
  const contactRecoil = !immunity && move.makesContact && defender.hp > 0 ? getContactRecoilRule(defender) : null;
  if (contactRecoil && fighter.hp > 0) {
    const recoil = Math.max(1, Math.floor(fighter.maxHp * contactRecoil.ratio));
    const hpBeforeRecoil = fighter.hp;
    const recoilSurvival = resolveLethalSurvival({ target: fighter, hpBefore: hpBeforeRecoil, damage: recoil, effect, eventId: `${eventId}:contact-recoil`, ownerRole: actor, source: defender });
    fighter.hp = recoilSurvival?.hp ?? Math.max(0, hpBeforeRecoil - recoil);
    reactiveAbility = contactRecoil.ability.id;
    addAbilityEvent(effect, abilityEvent({ ability: contactRecoil.ability, trigger: "AFTER_CONTACT_RECEIVED", owner: defender, source: defender, target: fighter, eventId: `${eventId}:contact-recoil`, effect: { type: "contact_recoil", damage: recoil, makesContact: true } }));
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
  const vampiricCrystal = activeItem(fighter, "vampiric-crystal")
    ? getItemDefinition("vampiric-crystal")
    : null;
  if (damage > 0 && vampiricCrystal && fighter.hp > 0) {
    const amount = heal(
      fighter,
      damage * (vampiricCrystal.rules?.damageHealPercent ?? 0),
    );
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
  applySynchronize(
    effect,
    defender,
    fighter,
    enemy,
    actor,
    eventId,
    state.revision + 1,
  );
  applySynchronize(
    effect,
    fighter,
    defender,
    actor,
    enemy,
    eventId,
    state.revision + 1,
  );
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
  if (resolution.abilityRule?.kind === "boost") {
    addAbilityEvent(
      effect,
      abilityEvent({
        ability: resolution.abilityRule.ability,
        trigger: "BEFORE_DAMAGE",
        owner: fighter,
        source: fighter,
        target: defender,
        eventId,
        effect: {
          type: "damage_multiplier",
          multiplier: resolution.abilityRule.multiplier,
        },
      }),
    );
  }
  effect.ability =
    resolution.abilityRule?.kind === "boost"
      ? resolution.abilityRule.ability.id
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
    addFaintEvent(effect, { pokemon: defender, owner: enemy, source: fighter, eventId: `${eventId}:faint:${defender.id}` });
    if (activeRelic(fighter)?.id === "veu-espectral" && fighter.hp > 0) {
      const before = fighter.momentum || 0;
      fighter.momentum = Math.min(MOMENTUM_CONFIG.MAX, before + (activeRelic(fighter).rules.momentumOnFaint || 1));
      if (fighter.momentum > before) {
        addMomentumEvent(effect, { type: "MOMENTUM_GAINED", pokemonId: fighter.id, owner: actor, before, after: fighter.momentum, amount: fighter.momentum - before, eventId: `${eventId}:relic-faint` });
        addItemEvent(effect, { itemId: "veu-espectral", pokemonId: fighter.id, targetPokemonId: fighter.id, equipmentSlot: "ELEMENTAL_RELIC", consumed: false, eventId: `${eventId}:relic-faint`, effect: { type: "momentum", amount: fighter.momentum - before } });
      }
    }
    const faintAbility = getCatalogAbility(fighter.abilityId || fighter.ability);
    if (faintAbility?.rule?.stat && faintAbility.hooks?.includes("ON_FAINT_OPPONENT") && fighter.hp > 0) {
      applyStatStageChange(fighter, fighter, actor, actor, faintAbility.rule.stat, faintAbility.rule.stages, effect, `${eventId}:faint`);
      addAbilityEvent(effect, abilityEvent({ ability: faintAbility, trigger: "ON_FAINT_OPPONENT", owner: fighter, source: fighter, target: defender, eventId: `${eventId}:moxie`, effect: { type: "stat_stage", stat: faintAbility.rule.stat, stages: faintAbility.rule.stages } }));
    }
    const replacement = next[enemy].team.findIndex((pokemon) => pokemon.hp > 0);
    if (replacement === -1) {
      next.status = "finished";
      next.winner = actor;
      next.performance.endedAt = Date.now();
      next.log = `${defender.name} desmaiou!`;
    } else {
      next[enemy].active = replacement;
      next.performance.players[enemy].hasSwitched = true;
      applyEnterAbility(next, enemy, actor, effect, `${eventId}:switch-in`);
      next.log = `${defender.name} desmaiou! Vai, ${next[enemy].team[replacement].name}!`;
      next.turn = enemy;
    }
  } else {
    finishActorTurn(next, actor, effect);
    if (fighter.hp <= 0) {
      addFaintEvent(effect, { pokemon: fighter, owner: actor, source: defender, eventId: `${eventId}:faint:${fighter.id}`, cause: effect.endStatus ? "status" : "automatic" });
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
        applyEnterAbility(next, actor, enemy, effect, `${eventId}:switch-in`);
      }
    }
    if (next.status !== "finished") next.turn = enemy;
  }
  next.revision += 1;
  return next;
}

// Battle state is plain structured data. Preserve undefined and aliases in the
// fallback; JSON round trips would lose values and are not equivalent.
export function cloneBattleState(state) {
  if (typeof globalThis.structuredClone === "function") return globalThis.structuredClone(state);
  const seen = new Map();
  const clone = value => {
    if (!value || typeof value !== "object") return value;
    if (seen.has(value)) return seen.get(value);
    const next = Array.isArray(value) ? [] : {};
    seen.set(value, next);
    for (const key of Object.keys(value)) next[key] = clone(value[key]);
    return next;
  };
  return clone(state);
}
