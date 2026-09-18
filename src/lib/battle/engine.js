import { BAG_ITEM_CATALOG, getItemDefinition, migrateLegacyItemId } from "@/lib/items/catalog";

// Framework-free, deterministic battle domain. The host runs this same
// pipeline for CPU, friends, tournaments and Badge Challenges.
const ADVANTAGES = { electric: ["water", "flying"], water: ["fire", "ground", "rock"], fire: ["grass", "ice", "bug", "steel"], grass: ["water", "ground", "rock"], fighting: ["normal", "rock", "steel", "ice", "dark"], ground: ["fire", "electric", "poison", "rock", "steel"], psychic: ["fighting", "poison"], ice: ["grass", "ground", "flying", "dragon"], dark: ["psychic", "ghost"], ghost: ["psychic", "ghost"], fairy: ["fighting", "dragon", "dark"], rock: ["fire", "ice", "flying", "bug"], flying: ["grass", "fighting", "bug"], poison: ["grass", "fairy"], bug: ["grass", "psychic", "dark"], steel: ["ice", "rock", "fairy"], dragon: ["dragon"] };

export const MAX_SPECIAL_ATTACK_USES = 2;
export const MAX_POTIONS = 2; // compatibility only; Bag stock now comes from inventory.
export const MAX_HEALS_PER_POKEMON = 3;
export const POTION_HEAL_PERCENTAGE = .4;
export const STATUS_DAMAGE_PERCENTAGE = .08;
export const BATTLE_BAG = Object.freeze(Object.fromEntries(BAG_ITEM_CATALOG.map((entry) => [entry.id, { id: entry.id, name: entry.name, quantity: 0, description: entry.shortDescription }])));
export const DAMAGE_BALANCE = Object.freeze({ SUPER_EFFECTIVE: 1.3, DOUBLE_WEAKNESS_CAP: 1.5, RESISTED: .75, STAB: 1.1, MIN_ATTACK_RATIO: .65, MAX_ATTACK_RATIO: 1.55, REGULAR_MIN: .06, REGULAR_MAX: .35, SPECIAL_MIN: .10, SPECIAL_MAX: .45, VARIANCE: .05 });
export const HELD_ITEM_TRIGGER = Object.freeze({ AFTER_DAMAGE_RECEIVED: "AFTER_DAMAGE", DAMAGE_CALCULATION: "DAMAGE_CALCULATION" });
export const HELD_ITEM_DEFINITIONS = Object.freeze(Object.fromEntries(["fruit-vital", "healing-core", "regeneration-leaf", "survival-amulet", "guardian-plate", "resistance-crystal", "arcane-mirror", "purifier", "power-claw", "elemental-core", "impact-crystal", "unstable-charge", "impulse-boots", "return-symbol", "strategist-eye", "poison-thorn", "vampiric-crystal", "special-fragment", "phoenix-heart", "challenger-crown", "void-fragment", "celestial-clock"].map((id) => [id, getItemDefinition(id)])));

const TYPE_MOVES = { normal: ["Tackle", "Quick Attack", "Hyper Beam"], fire: ["Ember", "Fire Fang", "Flamethrower"], water: ["Water Gun", "Aqua Tail", "Hydro Pump"], grass: ["Vine Whip", "Razor Leaf", "Solar Beam"], electric: ["Thunder Shock", "Spark", "Thunderbolt"], ice: ["Powder Snow", "Ice Fang", "Ice Beam"], fighting: ["Karate Chop", "Brick Break", "Close Combat"], poison: ["Poison Sting", "Acid", "Sludge Bomb"], ground: ["Mud-Slap", "Bulldoze", "Earthquake"], flying: ["Peck", "Wing Attack", "Air Slash"], psychic: ["Confusion", "Psybeam", "Psychic"], bug: ["Bug Bite", "X-Scissor", "Bug Buzz"], rock: ["Rock Throw", "Rock Slide", "Stone Edge"], ghost: ["Astonish", "Shadow Sneak", "Shadow Ball"], dragon: ["Dragon Breath", "Dragon Claw", "Dragon Pulse"], dark: ["Bite", "Assurance", "Dark Pulse"], steel: ["Metal Claw", "Iron Head", "Flash Cannon"], fairy: ["Fairy Wind", "Draining Kiss", "Moonblast"] };
const STATUS_BY_TYPE = { fire: "burn", poison: "poison", electric: "paralysis", ice: "sleep", grass: "sleep" };
const ABILITIES = { blaze: "fire", torrent: "water", overgrow: "grass" };
export const SUPPORTED_ABILITIES = Object.freeze({ blaze: "Com pouco HP, golpes Fire causam +20% de dano.", torrent: "Com pouco HP, golpes Water causam +20% de dano.", overgrow: "Com pouco HP, golpes Grass causam +20% de dano.", static: "Golpes físicos recebidos podem causar paralisia." });
export const MOVES = [{ id: "strike", name: "Investida", type: "normal", power: 40, accuracy: 100, damageClass: "physical", special: false }, { id: "type-strike", name: "Golpe de tipo", type: "own", power: 70, accuracy: 100, damageClass: "special", special: true }];

const normalizeTypes = (value) => Array.isArray(value) ? value : Array.isArray(value?.types) ? value.types.map((type) => typeof type === "string" ? type : type.type?.name || type.name).filter(Boolean) : [value?.type || value].filter(Boolean);
const heldItemId = (value) => migrateLegacyItemId(value);
const activeItem = (fighter, id) => heldItemId(fighter?.heldItem) === id;
const nextRandom = (state) => { const seed = ((state.rng || 123456789) * 1664525 + 1013904223) >>> 0; state.rng = seed; return seed / 4294967296; };
const hpRatio = (fighter) => getHpRatio(fighter?.hp, fighter?.maxHp);
const heal = (fighter, amount) => { const actual = Math.min(Math.max(0, Math.ceil(amount)), Math.max(0, fighter.maxHp - fighter.hp)); fighter.hp += actual; return actual; };
const consumeHeld = (fighter, itemId, eventId, effect = {}) => { fighter.heldItem = null; return { type: "held-item-activated", itemId, pokemonId: fighter.id, targetPokemonId: fighter.id, eventId, effect, consumed: true }; };
const addItemEvent = (effect, event) => { if (!event) return; effect.itemEvents = [...(effect.itemEvents || []), event]; if (event.consumed && !effect.heldItem) effect.heldItem = event; };

export function getSupportedAbility(ability) { return SUPPORTED_ABILITIES[ability] ? { id: ability, description: SUPPORTED_ABILITIES[ability] } : null; }
export function multiplier(attackType, defender) { return normalizeTypes(defender).reduce((total, defenseType) => total * (ADVANTAGES[attackType]?.includes(defenseType) ? DAMAGE_BALANCE.SUPER_EFFECTIVE : ADVANTAGES[defenseType]?.includes(attackType) ? DAMAGE_BALANCE.RESISTED : 1), 1); }
export function getTypeEffectiveness(attackType, defender) { return Math.min(DAMAGE_BALANCE.DOUBLE_WEAKNESS_CAP, multiplier(attackType, defender)); }
export function getOpponentWeaknesses(defender) { return Object.keys(ADVANTAGES).filter((attackType) => multiplier(attackType, defender) > 1); }
export function getPokemonMatchup(attacker, defender) { const factor = getTypeEffectiveness(normalizeTypes(attacker)[0] || "normal", defender); return factor > 1 ? "advantage" : factor < 1 ? "disadvantage" : "neutral"; }
export function getHpRatio(currentHp, maxHp) { return maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0; }
export function getPotionHealAmount(pokemon, percent = POTION_HEAL_PERCENTAGE) { return Math.min(Math.ceil(pokemon.maxHp * percent), pokemon.maxHp - pokemon.hp); }
export function getBattleMoves(pokemon) { const type = normalizeTypes(pokemon)[0] || "normal"; const names = TYPE_MOVES[type] || TYPE_MOVES.normal; const status = STATUS_BY_TYPE[type]; return [{ id: `${type}-quick`, name: names[0], type, power: 40, accuracy: 100, damageClass: "physical", special: false, statusEffect: status ? { id: status, chance: .18 } : null }, { id: `${type}-steady`, name: names[1], type, power: 60, accuracy: 100, damageClass: "physical", special: false }, { id: `${type}-special`, name: names[2], type, power: 90, accuracy: 100, damageClass: "special", special: true, statusEffect: status ? { id: status, chance: .3 } : null }]; }

function prepareFighter(pokemon) {
  const types = normalizeTypes(pokemon); const base = pokemon.baseStats || {}; const maxHp = pokemon.maxHp || base.hp || 90;
  const stats = { attack: pokemon.stats?.attack || base.attack || 50, defense: pokemon.stats?.defense || base.defense || 50, specialAttack: pokemon.stats?.specialAttack || base.specialAttack || base.attack || 50, specialDefense: pokemon.stats?.specialDefense || base.specialDefense || base.defense || 50, speed: pokemon.stats?.speed || base.speed || 50 };
  const defaults = getBattleMoves({ ...pokemon, types }); const custom = Array.isArray(pokemon.moveset) ? pokemon.moveset.filter((move) => move?.id && move?.power) : [];
  return { ...pokemon, types, type: types[0] || "normal", hp: pokemon.hp ?? maxHp, maxHp, stats, moves: custom.length >= 3 ? custom.slice(0, 4) : [...defaults, ...custom.filter((move) => !defaults.some((entry) => entry.id === move.id))].slice(0, 4), status: pokemon.status || null, heldItem: heldItemId(pokemon.heldItem), ability: pokemon.ability || null, specialAttackUsesRemaining: MAX_SPECIAL_ATTACK_USES, healsUsed: 0, rechargeUsed: false, temporaryEffects: {} };
}
function abilityBonus(fighter, type) { return ABILITIES[fighter.ability] === type && hpRatio(fighter) <= 1 / 3 ? 1.2 : 1; }
export function getMovePowerFactor(power = 40, special = false) { const base = power <= 40 ? .15 : power <= 60 ? .18 : power <= 80 ? .21 : power <= 100 ? .24 : .27; return base * (special ? 1.25 : 1); }

export function calculateDamage({ attacker, defender, move, variance = 1 }) {
  const attackType = move.type === "own" ? attacker.type : move.type; const attack = move.damageClass === "special" ? attacker.stats.specialAttack : attacker.stats.attack; const defense = move.damageClass === "special" ? defender.stats.specialDefense : defender.stats.defense;
  const ratio = Math.min(DAMAGE_BALANCE.MAX_ATTACK_RATIO, Math.max(DAMAGE_BALANCE.MIN_ATTACK_RATIO, attack / Math.max(1, defense))); const levelFactor = Math.min(1.2, Math.max(.85, 1 + ((attacker.level || 1) - (defender.level || 1)) * .025)); const effectiveness = getTypeEffectiveness(attackType, defender); const stab = attacker.types.includes(attackType) ? DAMAGE_BALANCE.STAB : 1; const special = Boolean(move.special); const minimum = special ? DAMAGE_BALANCE.SPECIAL_MIN : DAMAGE_BALANCE.REGULAR_MIN; const maximum = special ? DAMAGE_BALANCE.SPECIAL_MAX : DAMAGE_BALANCE.REGULAR_MAX;
  let outgoing = abilityBonus(attacker, attackType); let incoming = 1; const itemTriggers = [];
  if (activeItem(attacker, "power-claw")) outgoing *= 1.1;
  if (activeItem(attacker, "elemental-core") && attacker.types?.[0] === attackType) { outgoing *= 1.12; itemTriggers.push({ itemId: "elemental-core", consumed: false, multiplier: 1.12 }); }
  if (activeItem(attacker, "impact-crystal")) { outgoing *= 1.2; itemTriggers.push({ itemId: "impact-crystal", consumed: true, multiplier: 1.2, owner: "attacker" }); }
  if (activeItem(attacker, "unstable-charge") && hpRatio(attacker) <= .4) outgoing *= 1.15;
  if (attacker.temporaryEffects?.impulse) { outgoing *= 1.15; itemTriggers.push({ itemId: "impulse-boots", temporary: "impulse", multiplier: 1.15 }); }
  if (attacker.temporaryEffects?.stimulant) { outgoing *= 1.2; itemTriggers.push({ itemId: "stimulant", temporary: "stimulant", multiplier: 1.2 }); }
  if (attacker.temporaryEffects?.phoenix) { outgoing *= 1.15; itemTriggers.push({ itemId: "phoenix-heart", temporary: "phoenix", multiplier: 1.15 }); }
  if (activeItem(attacker, "special-fragment") && special) { outgoing *= 1.15; itemTriggers.push({ itemId: "special-fragment", consumed: true, multiplier: 1.15, owner: "attacker" }); }
  if (activeItem(attacker, "challenger-crown") && (defender.level || 1) > (attacker.level || 1)) outgoing *= 1.1;
  if (activeItem(defender, "power-claw")) incoming *= 1.05;
  if (activeItem(defender, "guardian-plate")) { incoming *= .75; itemTriggers.push({ itemId: "guardian-plate", consumed: true, multiplier: .75, owner: "defender" }); }
  if (activeItem(defender, "resistance-crystal") && effectiveness > 1) incoming *= .85;
  if (activeItem(defender, "void-fragment") && effectiveness > 1) { incoming *= .6; itemTriggers.push({ itemId: "void-fragment", consumed: true, multiplier: .6, owner: "defender" }); }
  if (activeItem(defender, "challenger-crown") && (attacker.level || 1) > (defender.level || 1)) incoming *= .9;
  if (defender.temporaryEffects?.barrier) { incoming *= .7; itemTriggers.push({ itemId: "instant-barrier", temporary: "barrier", multiplier: .7 }); }
  const basePercentage = Math.min(maximum, Math.max(minimum, getMovePowerFactor(move.power, special) * ratio * levelFactor * stab * effectiveness * variance));
  const percentage = basePercentage * outgoing * incoming;
  return { damage: Math.max(1, Math.round(defender.maxHp * percentage)), percentage, effectiveness, effectivenessLabel: effectiveness > 1 ? "super-effective" : effectiveness < 1 ? "resisted" : "neutral", stab: stab > 1, attackRatio: ratio, special, itemTriggers, heldItemBonus: itemTriggers.find((entry) => entry.owner === "attacker" || entry.itemId === "elemental-core") || null };
}

export function resolveHeldItemEvent({ trigger, owner, targetPokemonId, sourcePokemonId = null, eventId = null, processedEventIds = [] }) {
  const definition = getItemDefinition(heldItemId(owner?.heldItem));
  if (!definition || definition.usageType !== "HELD" || String(owner?.id) !== String(targetPokemonId) || (eventId && processedEventIds.includes(eventId)) || trigger !== HELD_ITEM_TRIGGER.AFTER_DAMAGE_RECEIVED || definition.trigger !== "AFTER_DAMAGE" || owner.hp <= 0 || hpRatio(owner) > definition.rules.hpRatioLTE) return null;
  if (definition.effectType === "HEAL_PERCENT") { const amount = heal(owner, owner.maxHp * definition.rules.healPercent); if (!amount) return null; return { ...consumeHeld(owner, definition.id, eventId, { type: "heal_hp", amount }), sourcePokemonId, beforeHp: owner.hp - amount, afterHp: owner.hp, trigger }; }
  if (definition.effectType === "REGENERATION") { owner.temporaryEffects.regeneration = { ticks: definition.rules.ticks, healPercent: definition.rules.healPercent }; return { ...consumeHeld(owner, definition.id, eventId, { type: "regeneration", ticks: definition.rules.ticks }), sourcePokemonId, trigger }; }
  return null;
}
export function resolvePostDamageHeldItem(fighter) { return resolveHeldItemEvent({ trigger: HELD_ITEM_TRIGGER.AFTER_DAMAGE_RECEIVED, owner: fighter, targetPokemonId: fighter?.id }); }

function applySupportedStatus(target, statusId, ownerRole, effect, eventId) {
  if (!target || target.hp <= 0 || target.status || !statusId) return null;
  const prevention = heldItemId(target.heldItem);
  if (["arcane-mirror", "celestial-clock"].includes(prevention)) {
    const recovery = prevention === "celestial-clock" ? heal(target, target.maxHp * .1) : 0;
    addItemEvent(effect, { ...consumeHeld(target, prevention, eventId, { type: "prevent_status", status: statusId, healing: recovery }), owner: ownerRole });
    return null;
  }
  target.status = { id: statusId, turns: statusId === "sleep" ? 2 : 0 };
  if (activeItem(target, "purifier")) {
    target.status = null;
    addItemEvent(effect, { ...consumeHeld(target, "purifier", eventId, { type: "cure_status", status: statusId }), owner: ownerRole });
  }
  return statusId;
}

function finishActorTurn(next, actor, effect) {
  const fighter = next[actor].team[next[actor].active]; if (!fighter || fighter.hp <= 0) return;
  if (fighter.status && ["burn", "poison"].includes(fighter.status.id)) { const damage = Math.max(1, Math.ceil(fighter.maxHp * STATUS_DAMAGE_PERCENTAGE)); fighter.hp = Math.max(0, fighter.hp - damage); effect.endStatus = { status: fighter.status.id, damage }; }
  if (fighter.hp > 0 && fighter.temporaryEffects?.regeneration?.ticks > 0) { const amount = heal(fighter, fighter.maxHp * fighter.temporaryEffects.regeneration.healPercent); fighter.temporaryEffects.regeneration.ticks -= 1; if (!fighter.temporaryEffects.regeneration.ticks) delete fighter.temporaryEffects.regeneration; if (amount) addItemEvent(effect, { itemId: "regeneration-leaf", pokemonId: fighter.id, targetPokemonId: fighter.id, consumed: false, effect: { type: "heal_hp", amount } }); }
}

export function createBattleState(host, guest, firstTurn) {
  const preparePlayer = (player) => { const bag = Object.fromEntries(BAG_ITEM_CATALOG.map((entry) => [entry.id, Math.max(0, Math.floor(Number(player.inventory?.[entry.id]) || 0))])); return { ...player, active: 0, bag, initialBag: { ...bag }, potionsRemaining: bag["vital-potion"] || 0, team: player.team.map(prepareFighter) }; };
  const preparedHost = preparePlayer(host); const preparedGuest = preparePlayer(guest); const fasterGuest = (preparedGuest.team[0]?.stats.speed || 0) > (preparedHost.team[0]?.stats.speed || 0);
  return { host: preparedHost, guest: preparedGuest, turn: firstTurn || (fasterGuest ? "guest" : "host"), status: "playing", winner: null, log: "A batalha começou!", effect: null, rng: 123456789, resolvedItemEventIds: [], performance: { startedAt: null, endedAt: null, players: { host: { hasSwitched: false }, guest: { hasSwitched: false } } }, revision: 0 };
}

function resolveBagAction(state, next, actor, enemy, action) {
  const itemId = action.type === "potion" ? "vital-potion" : migrateLegacyItemId(action.itemId); const definition = getItemDefinition(itemId); const targetIndex = next[actor].team.findIndex((pokemon) => String(pokemon.id) === String(action.targetPokemonId)); const target = next[actor].team[targetIndex]; const quantity = next[actor].bag?.[itemId] || 0;
  if (!definition || definition.usageType !== "BAG" || !target || !quantity || target.hp <= 0) return state;
  let healing = 0; let curedStatus = null;
  if (definition.effectType === "BAG_HEAL") { if (target.hp >= target.maxHp || target.healsUsed >= MAX_HEALS_PER_POKEMON) return state; healing = heal(target, target.maxHp * definition.rules.healPercent); if (!healing) return state; target.healsUsed += 1; }
  else if (definition.effectType === "BAG_CURE") { if (!target.status) return state; curedStatus = target.status.id; target.status = null; }
  else if (definition.effectType === "BAG_BARRIER") { if (targetIndex !== next[actor].active || target.temporaryEffects.barrier) return state; target.temporaryEffects.barrier = true; }
  else if (definition.effectType === "BAG_STIMULANT") { if (targetIndex !== next[actor].active || target.temporaryEffects.stimulant) return state; target.temporaryEffects.stimulant = true; }
  else if (definition.effectType === "BAG_RECHARGE") { if (target.specialAttackUsesRemaining >= MAX_SPECIAL_ATTACK_USES || target.rechargeUsed) return state; target.specialAttackUsesRemaining += 1; target.rechargeUsed = true; }
  else return state;
  next[actor].bag[itemId] = quantity - 1; next[actor].potionsRemaining = next[actor].bag["vital-potion"] || 0; next.turn = enemy; next.log = `${definition.name} usado em ${target.name}!`; next.effect = { kind: "item", itemId, itemName: definition.name, actor, target: actor, targetPokemonId: target.id, targetIndex, healing, curedStatus, remaining: next[actor].bag[itemId], result: { applied: true, consumed: true, itemId, targetPokemonId: target.id, healing, curedStatus } }; next.revision += 1; return next;
}

export function resolveAction(state, actor, action) {
  if (state.status !== "playing" || state.turn !== actor) return state;
  const enemy = actor === "host" ? "guest" : "host"; const next = structuredClone(state); const fighter = next[actor].team[next[actor].active];
  if (action.type === "switch") {
    const incoming = next[actor].team[action.index]; if (!incoming || incoming.hp <= 0 || action.index === next[actor].active) return state;
    const outgoing = fighter; const itemId = heldItemId(outgoing.heldItem); const effect = { kind: "switch", actor, itemEvents: [] };
    if (itemId === "return-symbol" && outgoing.hp > 0) { const amount = heal(outgoing, outgoing.maxHp * .1); addItemEvent(effect, consumeHeld(outgoing, itemId, action.actionId || `${actor}:${state.revision + 1}:switch`, { type: "heal_hp", amount })); }
    next[actor].active = action.index; incoming.temporaryEffects.impulse = activeItem(incoming, "impulse-boots") || undefined; next.performance.players[actor].hasSwitched = true; next.turn = enemy; next.log = `Vai, ${incoming.name}!`; next.effect = effect; next.revision += 1; return next;
  }
  if (action.type === "potion" || action.type === "item") return resolveBagAction(state, next, actor, enemy, action);
  const move = fighter.moves.find((entry) => entry.id === action.moveId) || MOVES.find((entry) => entry.id === action.moveId); const defender = next[enemy].team[next[enemy].active];
  if (!move || !defender || (move.special && fighter.specialAttackUsesRemaining <= 0)) return state;
  if (fighter.status?.id === "sleep") { fighter.status.turns -= 1; if (fighter.status.turns <= 0) fighter.status = null; next.turn = enemy; next.log = `${fighter.name} está dormindo!`; next.effect = { kind: "status", actor, target: actor, status: "sleep" }; next.revision += 1; return next; }
  if (fighter.status?.id === "paralysis" && nextRandom(next) < .25) { next.turn = enemy; next.log = `${fighter.name} está paralisado e não conseguiu agir!`; next.effect = { kind: "status", actor, target: actor, status: "paralysis" }; next.revision += 1; return next; }
  if (nextRandom(next) > (move.accuracy ?? 100) / 100) { next.turn = enemy; next.log = `${fighter.name} errou ${move.name}!`; next.effect = { kind: "miss", actor, target: enemy, type: move.type }; next.revision += 1; return next; }
  const attackType = move.type === "own" ? fighter.type : move.type; const resolution = calculateDamage({ attacker: fighter, defender, move, variance: 1 - DAMAGE_BALANCE.VARIANCE + nextRandom(next) * DAMAGE_BALANCE.VARIANCE * 2 }); const eventId = action.actionId || `${actor}:${state.revision + 1}:${fighter.id}:${defender.id}:${move.id}`; const beforeHp = defender.hp; let damage = Math.min(beforeHp, resolution.damage); const effect = { kind: "attack", actor, target: enemy, type: attackType, damage, effective: resolution.effectiveness > 1, special: move.special, moveName: move.name, damageResolution: resolution, itemEvents: [] };
  for (const trigger of resolution.itemTriggers) {
    if (trigger.temporary) { const owner = trigger.temporary === "barrier" ? defender : fighter; delete owner.temporaryEffects[trigger.temporary]; addItemEvent(effect, { itemId: trigger.itemId, pokemonId: owner.id, targetPokemonId: owner.id, consumed: false, eventId, effect: { type: "damage_multiplier", multiplier: trigger.multiplier } }); }
    if (trigger.consumed) { const owner = trigger.owner === "defender" ? defender : fighter; const ownerRole = trigger.owner === "defender" ? enemy : actor; addItemEvent(effect, { ...consumeHeld(owner, trigger.itemId, eventId, { type: "damage_multiplier", multiplier: trigger.multiplier }), owner: ownerRole }); }
  }
  const lethalItem = heldItemId(defender.heldItem); if (damage >= beforeHp && ["survival-amulet", "phoenix-heart"].includes(lethalItem) && beforeHp > 0) { damage = Math.max(0, beforeHp - 1); if (lethalItem === "phoenix-heart") defender.temporaryEffects.phoenix = true; addItemEvent(effect, { ...consumeHeld(defender, lethalItem, eventId, { type: "survive", hp: 1, nextAttackMultiplier: lethalItem === "phoenix-heart" ? 1.15 : null }), owner: enemy }); }
  if (move.special) fighter.specialAttackUsesRemaining -= 1; defender.hp = Math.max(0, beforeHp - damage); effect.damage = damage;
  let status = null; let reactiveAbility = null; const attemptedStatus = !defender.status && move.statusEffect && nextRandom(next) < move.statusEffect.chance ? move.statusEffect.id : null;
  if (attemptedStatus) status = applySupportedStatus(defender, attemptedStatus, enemy, effect, eventId);
  if (defender.ability === "static" && move.damageClass === "physical" && nextRandom(next) < .2) { status = applySupportedStatus(fighter, "paralysis", actor, effect, eventId) || status; reactiveAbility = "static"; }
  if (damage > 0 && activeItem(defender, "poison-thorn") && nextRandom(next) < .2) { const poisoned = applySupportedStatus(fighter, "poison", actor, effect, eventId); if (poisoned) { status = poisoned; addItemEvent(effect, { itemId: "poison-thorn", pokemonId: defender.id, targetPokemonId: fighter.id, consumed: false, eventId, effect: { type: "status", status: "poison" } }); } }
  if (damage > 0 && activeItem(fighter, "vampiric-crystal") && fighter.hp > 0) { const amount = heal(fighter, damage * .05); if (amount) addItemEvent(effect, { itemId: "vampiric-crystal", pokemonId: fighter.id, targetPokemonId: fighter.id, consumed: false, eventId, effect: { type: "heal_hp", amount } }); }
  const automatic = resolveHeldItemEvent({ trigger: HELD_ITEM_TRIGGER.AFTER_DAMAGE_RECEIVED, owner: defender, targetPokemonId: defender.id, sourcePokemonId: fighter.id, eventId, processedEventIds: next.resolvedItemEventIds || [] }); if (automatic) addItemEvent(effect, { ...automatic, owner: enemy });
  effect.status = status; effect.ability = resolution.percentage > 0 && abilityBonus(fighter, attackType) > 1 ? fighter.ability : reactiveAbility; effect.amplifier = resolution.heldItemBonus; next.effect = effect; next.resolvedItemEventIds = [...(next.resolvedItemEventIds || []), eventId].slice(-100); next.log = resolution.effectiveness > 1 ? "SUPER EFETIVO!" : `${fighter.name} usou ${move.name}!`;
  if (defender.hp === 0) { const replacement = next[enemy].team.findIndex((pokemon) => pokemon.hp > 0); if (replacement === -1) { next.status = "finished"; next.winner = actor; next.performance.endedAt = Date.now(); next.log = `${defender.name} desmaiou!`; } else { next[enemy].active = replacement; next.performance.players[enemy].hasSwitched = true; next.log = `${defender.name} desmaiou! Vai, ${next[enemy].team[replacement].name}!`; next.turn = enemy; } }
  else { finishActorTurn(next, actor, effect); if (fighter.hp <= 0) { const replacement = next[actor].team.findIndex((pokemon) => pokemon.hp > 0); if (replacement === -1) { next.status = "finished"; next.winner = enemy; next.performance.endedAt = Date.now(); } else { next[actor].active = replacement; next.performance.players[actor].hasSwitched = true; } } if (next.status !== "finished") next.turn = enemy; }
  next.revision += 1; return next;
}
