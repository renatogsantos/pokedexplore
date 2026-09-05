const ADVANTAGES = { electric: ["water", "flying"], water: ["fire", "ground", "rock"], fire: ["grass", "ice", "bug", "steel"], grass: ["water", "ground", "rock"], fighting: ["normal", "rock", "steel", "ice", "dark"], ground: ["fire", "electric", "poison", "rock", "steel"], psychic: ["fighting", "poison"], ice: ["grass", "ground", "flying", "dragon"], dark: ["psychic", "ghost"], ghost: ["psychic", "ghost"], fairy: ["fighting", "dragon", "dark"], rock: ["fire", "ice", "flying", "bug"], flying: ["grass", "fighting", "bug"], poison: ["grass", "fairy"], bug: ["grass", "psychic", "dark"], steel: ["ice", "rock", "fairy"], dragon: ["dragon"] };

export const MOVES = [{ id: "strike", name: "Investida", type: "normal", power: 15, special: false }, { id: "type-strike", name: "Golpe de tipo", type: "own", power: 23, special: true }];
export const MAX_POTIONS = 2;
export const POTION_HEAL_PERCENTAGE = 0.4;
export const MAX_SPECIAL_ATTACK_USES = 2;

const normalizeTypes = (value) => Array.isArray(value) ? value : Array.isArray(value?.types) ? value.types.map((type) => typeof type === "string" ? type : type.type?.name || type.name).filter(Boolean) : [value?.type || value].filter(Boolean);
export function multiplier(attackType, defender) { return normalizeTypes(defender).reduce((total, defenseType) => total * (ADVANTAGES[attackType]?.includes(defenseType) ? 1.5 : ADVANTAGES[defenseType]?.includes(attackType) ? .75 : 1), 1); }
export function getOpponentWeaknesses(defender) { return Object.keys(ADVANTAGES).filter((attackType) => multiplier(attackType, defender) > 1); }
export function getPokemonMatchup(attacker, defender) { const specialMultiplier = multiplier(normalizeTypes(attacker)[0] || "normal", defender); return specialMultiplier > 1 ? "advantage" : specialMultiplier < 1 ? "disadvantage" : "neutral"; }
export function getPotionHealAmount(pokemon) { return Math.min(Math.ceil(pokemon.maxHp * POTION_HEAL_PERCENTAGE), pokemon.maxHp - pokemon.hp); }

function prepareFighter(pokemon) { const types = normalizeTypes(pokemon); const maxHp = pokemon.maxHp || 90; return { ...pokemon, types, type: types[0] || "normal", hp: pokemon.hp ?? maxHp, maxHp, attackMultiplier: pokemon.attackMultiplier || 1, specialAttackUsesRemaining: MAX_SPECIAL_ATTACK_USES }; }
export function createBattleState(host, guest, firstTurn = "host") { return { host: { ...host, active: 0, potionsRemaining: MAX_POTIONS, team: host.team.map(prepareFighter) }, guest: { ...guest, active: 0, potionsRemaining: MAX_POTIONS, team: guest.team.map(prepareFighter) }, turn: firstTurn, status: "playing", winner: null, log: "A batalha começou!", effect: null, revision: 0 }; }

export function resolveAction(state, actor, action) {
  if (state.status !== "playing" || state.turn !== actor) return state;
  const enemy = actor === "host" ? "guest" : "host"; const next = structuredClone(state);
  if (action.type === "potion") { const targetIndex = next[actor].team.findIndex((pokemon) => String(pokemon.id) === String(action.targetPokemonId)); const target = next[actor].team[targetIndex]; if (!target || next[actor].potionsRemaining <= 0 || target.hp <= 0 || target.hp >= target.maxHp) return state; const healing = getPotionHealAmount(target); target.hp = Math.min(target.maxHp, target.hp + healing); next[actor].potionsRemaining -= 1; next.turn = enemy; next.log = `${target.name} recuperou ${healing} HP!`; next.effect = { kind: "potion", actor, target: actor, targetPokemonId: target.id, targetIndex, healing }; next.revision += 1; return next; }
  if (action.type === "switch") { if (!next[actor].team[action.index] || next[actor].team[action.index].hp <= 0 || action.index === next[actor].active) return state; next[actor].active = action.index; next.turn = enemy; next.log = `Vai, ${next[actor].team[action.index].name}!`; next.effect = { kind: "switch", actor }; next.revision += 1; return next; }
  const move = MOVES.find((item) => item.id === action.moveId); const attacker = next[actor].team[next[actor].active]; const defender = next[enemy].team[next[enemy].active];
  if (!move || !attacker || !defender || (move.special && attacker.specialAttackUsesRemaining <= 0)) return state;
  const attackType = move.type === "own" ? attacker.type : move.type; const factor = multiplier(attackType, defender); const damage = Math.round(move.power * attacker.attackMultiplier * factor); if (move.special) attacker.specialAttackUsesRemaining -= 1;
  defender.hp = Math.max(0, defender.hp - damage); next.log = factor > 1 ? "SUPER EFETIVO!" : `${attacker.name} usou ${move.name}!`; next.effect = { kind: "attack", actor, target: enemy, type: attackType, damage, effective: factor > 1, special: move.special };
  if (defender.hp === 0) { const replacement = next[enemy].team.findIndex((pokemon) => pokemon.hp > 0); if (replacement === -1) { next.status = "finished"; next.winner = actor; next.log = `${defender.name} desmaiou!`; } else { next[enemy].active = replacement; next.log = `${defender.name} desmaiou! Vai, ${next[enemy].team[replacement].name}!`; next.turn = enemy; } } else next.turn = enemy;
  next.revision += 1; return next;
}
