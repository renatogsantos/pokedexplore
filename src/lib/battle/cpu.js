import {
  calculateDamage,
  getHpRatio,
  getPotionHealAmount,
  getTypeEffectiveness,
} from "@/lib/battle/engine";
import { CPU_ROSTER } from "@/lib/battle/pokemon";
import { BAG_ITEM_CATALOG, ITEM_CATALOG } from "@/lib/items/catalog";

export const CPU_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: "easy", label: "Fácil", summary: "CPU mais casual", baseCoins: 15,
    itemDropChance: 0.20, levelOffset: -1, decisionNoise: 0.48,
    switchThreshold: 0.18, itemThreshold: 0.18,
    itemRarities: ["COMMON", "COMMON", "COMMON", "RARE"],
  }),
  normal: Object.freeze({
    id: "normal", label: "Normal", summary: "CPU estratégica", baseCoins: 30,
    itemDropChance: 0.35, levelOffset: 0, decisionNoise: 0.20,
    switchThreshold: 0.52, itemThreshold: 0.38,
    itemRarities: ["COMMON", "COMMON", "RARE", "RARE", "EPIC"],
  }),
  hard: Object.freeze({
    id: "hard", label: "Difícil", summary: "CPU avançada", baseCoins: 60,
    itemDropChance: 0.55, levelOffset: 1, decisionNoise: 0.07,
    switchThreshold: 0.78, itemThreshold: 0.62,
    // Legendary remains a 3% outcome only after the 55% item-drop roll.
    itemRarities: ["COMMON", "RARE", "RARE", "EPIC", "EPIC"],
  }),
});

export function getCpuDifficulty(value) {
  return CPU_DIFFICULTIES[value] || CPU_DIFFICULTIES.normal;
}

const clampLevel = (value) => Math.max(1, Math.min(10, Math.round(value)));
const shuffle = (list, random) => {
  const next = [...list];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
};
const teamKey = (team) => team.map((pokemon) => pokemon.id).sort((a, b) => a - b).join("-");
const typeSet = (pokemon) => new Set(pokemon.types || [pokemon.type]);
const power = (pokemon) => Object.values(pokemon.baseStats || {}).reduce((sum, value) => sum + Number(value || 0), 0);

/** A fair builder: it never inspects the player's types, only the selected difficulty. */
export function generateCpuTeam({ difficulty = "normal", playerTeam = [], recentTeams = [], random = Math.random } = {}) {
  const config = getCpuDifficulty(difficulty);
  const averageLevel = playerTeam.length
    ? playerTeam.reduce((sum, pokemon) => sum + Number(pokemon.level || 1), 0) / playerTeam.length
    : 1;
  const targetLevel = clampLevel(averageLevel + config.levelOffset);
  const recent = new Set(recentTeams.map((team) => Array.isArray(team) ? teamKey(team) : String(team)));
  const candidates = shuffle(CPU_ROSTER, random);
  const selected = [];
  const chosenTypes = new Set();

  while (selected.length < 3 && candidates.length) {
    const ranked = candidates.map((pokemon) => {
      const types = typeSet(pokemon);
      const newTypes = [...types].filter((type) => !chosenTypes.has(type)).length;
      const duplicatePenalty = [...types].some((type) => chosenTypes.has(type)) ? 22 : 0;
      const strength = power(pokemon) / 40;
      const variance = random() * 16;
      return { pokemon, score: newTypes * 42 + strength - duplicatePenalty + variance };
    }).sort((left, right) => right.score - left.score);
    const pick = ranked[Math.min(ranked.length - 1, Math.floor(random() * Math.min(3, ranked.length)))].pokemon;
    selected.push({ ...pick, types: [...pick.types], baseStats: { ...pick.baseStats }, level: targetLevel });
    typeSet(pick).forEach((type) => chosenTypes.add(type));
    candidates.splice(candidates.findIndex((candidate) => candidate.id === pick.id), 1);
  }

  // A reroll is only used to avoid the exact recent trio; the result is still frozen by the match creator.
  if (recent.has(teamKey(selected)) && CPU_ROSTER.length > 3) {
    return generateCpuTeam({ difficulty, playerTeam, recentTeams: [], random });
  }
  return selected;
}

export function createCpuInventory(difficulty = "normal") {
  const config = getCpuDifficulty(difficulty);
  if (config.id === "easy") return {};
  if (config.id === "normal") return { "vital-potion": 1, "purifying-elixir": 1 };
  return { "vital-potion": 1, "purifying-elixir": 1, "instant-barrier": 1, stimulant: 1, "recharge-crystal": 1 };
}

function scoreMove(move, attacker, defender, config) {
  const damage = calculateDamage({ attacker, defender, move, variance: 1 }).damage;
  const attackType = move.type === "own" ? attacker.type : move.type;
  const effectiveness = getTypeEffectiveness(attackType, defender);
  const koBonus = damage >= defender.hp ? 180 : 0;
  const specialCost = move.special && attacker.specialAttackUsesRemaining <= 1 && damage < defender.hp ? 8 : 0;
  const statusBonus = move.statusEffect && !defender.status ? (config.id === "easy" ? 3 : 14) : 0;
  return damage + effectiveness * (config.id === "easy" ? 5 : 22) + koBonus + statusBonus - specialCost;
}

function bestSwitch(state, config) {
  const active = state.guest.team[state.guest.active];
  const opponent = state.host.team[state.host.active];
  const currentMatchup = getTypeEffectiveness(active.type, opponent);
  const candidates = state.guest.team
    .map((pokemon, index) => ({ pokemon, index }))
    .filter(({ pokemon, index }) => index !== state.guest.active && pokemon.hp > 0)
    .map(({ pokemon, index }) => ({
      index,
      score: getTypeEffectiveness(pokemon.type, opponent) * 55 + getHpRatio(pokemon.hp, pokemon.maxHp) * 32,
    }))
    .sort((left, right) => right.score - left.score);
  const candidate = candidates[0];
  const pressured = currentMatchup < 1 || getHpRatio(active.hp, active.maxHp) <= 0.35;
  return pressured && candidate?.score >= 95 && config.switchThreshold > 0.2 ? candidate : null;
}

function itemIntent(state, config) {
  const active = state.guest.team[state.guest.active];
  const bag = state.guest.bag || {};
  const hp = getHpRatio(active.hp, active.maxHp);
  if (config.itemThreshold <= 0 || !active.hp) return null;
  if (active.status && bag["purifying-elixir"] && config.id !== "easy")
    return { type: "item", itemId: "purifying-elixir", targetPokemonId: active.id };
  if (hp <= 0.32 && bag["vital-potion"] && getPotionHealAmount(active) > 0)
    return { type: "potion", targetPokemonId: active.id };
  if (hp <= 0.45 && bag["instant-barrier"] && !active.temporaryEffects?.barrier && config.id === "hard")
    return { type: "item", itemId: "instant-barrier", targetPokemonId: active.id };
  if (bag.stimulant && config.id === "hard" && getHpRatio(state.host.team[state.host.active].hp, state.host.team[state.host.active].maxHp) <= 0.35)
    return { type: "item", itemId: "stimulant", targetPokemonId: active.id };
  return null;
}

/** Returns an engine action only. It never applies damage, mutates state, or predicts RNG. */
export function decideCpuIntent(state, { difficulty = "normal", random = Math.random } = {}) {
  const config = getCpuDifficulty(difficulty);
  const active = state?.guest?.team?.[state.guest.active];
  const opponent = state?.host?.team?.[state.host.active];
  if (!active || !opponent || active.hp <= 0) return { type: "attack", moveId: "strike" };
  const switchChoice = bestSwitch(state, config);
  const item = itemIntent(state, config);
  if (switchChoice && random() < config.switchThreshold) return { type: "switch", index: switchChoice.index };
  if (item && random() < config.itemThreshold) return item;
  const moves = (active.moves || []).filter((move) => !move.special || active.specialAttackUsesRemaining > 0);
  const ranked = moves.map((move) => ({ move, score: scoreMove(move, active, opponent, config) }))
    .sort((left, right) => right.score - left.score);
  const spread = config.id === "easy" ? Math.min(3, ranked.length) : config.id === "normal" ? Math.min(2, ranked.length) : 1;
  const picked = ranked[Math.floor(random() * spread)]?.move || moves[0];
  return { type: "attack", moveId: picked?.id || "strike" };
}

export function rollCpuItemDrop(difficulty = "normal", random = Math.random) {
  const config = getCpuDifficulty(difficulty);
  if (random() >= config.itemDropChance) return null;
  const rarity = config.id === "hard" && random() < 0.03
    ? "LEGENDARY"
    : config.itemRarities[Math.floor(random() * config.itemRarities.length)];
  const pool = ITEM_CATALOG.filter((item) => item.rarity === rarity);
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

export function createCpuVictoryReward(difficulty = "normal", random = Math.random) {
  const config = getCpuDifficulty(difficulty);
  const item = rollCpuItemDrop(config.id, random);
  return { difficulty: config.id, baseCoins: config.baseCoins, itemId: item?.id || null };
}

export const CPU_BAG_ITEM_IDS = Object.freeze(BAG_ITEM_CATALOG.map((item) => item.id));
