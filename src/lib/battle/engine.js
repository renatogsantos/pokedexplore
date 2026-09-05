const ADVANTAGES = { electric: ["water", "flying"], water: ["fire", "ground", "rock"], fire: ["grass", "ice", "bug", "steel"], grass: ["water", "ground", "rock"], fighting: ["normal", "rock", "steel", "ice", "dark"], ground: ["fire", "electric", "poison", "rock", "steel"], psychic: ["fighting", "poison"], ice: ["grass", "ground", "flying", "dragon"], dark: ["psychic", "ghost"], ghost: ["psychic", "ghost"], fairy: ["fighting", "dragon", "dark"], rock: ["fire", "ice", "flying", "bug"], flying: ["grass", "fighting", "bug"], poison: ["grass", "fairy"], bug: ["grass", "psychic", "dark"], steel: ["ice", "rock", "fairy"], dragon: ["dragon"] };

export const MOVES = [
  { id: "strike", name: "Investida", type: "normal", power: 15 },
  { id: "type-strike", name: "Golpe de tipo", type: "own", power: 23 },
];

export const MAX_POTIONS = 2;
export const POTION_HEAL_PERCENTAGE = 0.4;

export function getPotionHealAmount(pokemon) {
  return Math.min(Math.ceil(pokemon.maxHp * POTION_HEAL_PERCENTAGE), pokemon.maxHp - pokemon.hp);
}

export function multiplier(attackType, defenseType) {
  if (ADVANTAGES[attackType]?.includes(defenseType)) return 1.5;
  return 1;
}

export function createBattleState(host, guest, firstTurn = "host") {
  host = { ...host, potionsRemaining: MAX_POTIONS };
  guest = { ...guest, potionsRemaining: MAX_POTIONS };
  return { host: { ...host, active: 0, team: host.team.map((pokemon) => ({ ...pokemon })) }, guest: { ...guest, active: 0, team: guest.team.map((pokemon) => ({ ...pokemon })) }, turn: firstTurn, status: "playing", winner: null, log: "A batalha começou!", effect: null, revision: 0 };
}

export function resolveAction(state, actor, action) {
  if (state.status !== "playing" || state.turn !== actor) return state;
  const enemy = actor === "host" ? "guest" : "host";
  const next = structuredClone(state);
  if (action.type === "potion") {
    const targetIndex = next[actor].team.findIndex((pokemon) => String(pokemon.id) === String(action.targetPokemonId));
    const target = next[actor].team[targetIndex];
    if (!target || next[actor].potionsRemaining <= 0 || target.hp <= 0 || target.hp >= target.maxHp) return state;
    const healing = getPotionHealAmount(target);
    target.hp = Math.min(target.maxHp, target.hp + healing);
    next[actor].potionsRemaining -= 1;
    next.turn = enemy;
    next.log = `${target.name} recuperou ${healing} HP!`;
    next.effect = { kind: "potion", actor, target: actor, targetPokemonId: target.id, targetIndex, healing };
    next.revision += 1;
    return next;
  }
  if (action.type === "switch") {
    if (!next[actor].team[action.index] || next[actor].team[action.index].hp <= 0 || action.index === next[actor].active) return state;
    next[actor].active = action.index;
    next.turn = enemy;
    next.log = `Vai, ${next[actor].team[action.index].name}!`;
    next.effect = { kind: "switch", actor };
    next.revision += 1;
    return next;
  }
  const move = MOVES.find((item) => item.id === action.moveId);
  if (!move) return state;
  const attacker = next[actor].team[next[actor].active];
  const defender = next[enemy].team[next[enemy].active];
  const attackType = move.type === "own" ? attacker.type : move.type;
  const factor = multiplier(attackType, defender.type);
  const damage = Math.round(move.power * factor);
  defender.hp = Math.max(0, defender.hp - damage);
  next.log = factor > 1 ? "SUPER EFETIVO!" : `${attacker.name} usou ${move.name}!`;
  next.effect = { kind: "attack", actor, target: enemy, type: attackType, damage, effective: factor > 1 };
  if (defender.hp === 0) {
    const replacement = next[enemy].team.findIndex((pokemon) => pokemon.hp > 0);
    if (replacement === -1) { next.status = "finished"; next.winner = actor; next.log = `${defender.name} desmaiou!`; }
    else { next[enemy].active = replacement; next.log = `${defender.name} desmaiou! Vai, ${next[enemy].team[replacement].name}!`; next.turn = enemy; }
  } else next.turn = enemy;
  next.revision += 1;
  return next;
}
