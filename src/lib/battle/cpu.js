import {
  calculateDamage,
  analyzeMoveDecision,
  getHpRatio,
  getBagItemUseBlockReason,
  getPotionHealAmount,
  getTypeEffectiveness,
} from "@/lib/battle/engine";
import { CPU_ROSTER } from "@/lib/battle/pokemon";
import { BAG_ITEM_CATALOG, ITEM_CATALOG } from "@/lib/items/catalog";

export const CPU_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({
    id: "easy", label: "Fácil", summary: "Times iniciais · estratégia básica", baseCoins: 15,
    itemDropChance: 0.20, levelRange: [-2, 0], decisionNoise: 0.48,
    switchThreshold: 0.18, itemThreshold: 0.18, maxBst: 465,
    teamBudget: [930, 1240], archetypes: ["balanced", "type-coverage"],
    categoryWeights: { basic: 1 }, momentumValue: 5, specialReserve: 0,
    itemRarities: ["COMMON", "COMMON", "COMMON", "RARE"],
  }),
  medium: Object.freeze({
    id: "medium", label: "Médio", summary: "Pokémon fortes · boa estratégia", baseCoins: 30,
    itemDropChance: 0.35, levelRange: [-1, 1], decisionNoise: 0.20,
    switchThreshold: 0.52, itemThreshold: 0.38, minBst: 390, maxBst: 570,
    teamBudget: [1240, 1580], archetypes: ["balanced", "offensive", "defensive", "type-coverage", "status"],
    categoryWeights: { basic: 1, evolved: 5, powerful: 3, pseudo: 0 }, momentumValue: 13, specialReserve: 1,
    itemRarities: ["COMMON", "COMMON", "RARE", "RARE", "EPIC"],
  }),
  hard: Object.freeze({
    id: "hard", label: "Difícil", summary: "Time elite · Lendários raros · estratégia avançada", baseCoins: 60,
    itemDropChance: 0.55, levelRange: [0, 2], decisionNoise: 0.07,
    switchThreshold: 0.78, itemThreshold: 0.62, minBst: 480,
    teamBudget: [1540, 1810], archetypes: ["balanced", "offensive", "defensive", "fast", "status", "heavy-hitters", "type-coverage"],
    // Per-slot category weights. Mythicals remain intentionally rarer than Legendaries.
    categoryWeights: { basic: 1, evolved: 3, powerful: 7, pseudo: 3, legendary: 1.15, mythical: 0.35 }, legendarySlotChance: 0.13, mythicalSlotChance: 0.035, momentumValue: 23, specialReserve: 1,
    itemRarities: ["COMMON", "RARE", "RARE", "EPIC", "EPIC"],
  }),
});

export function getCpuDifficulty(value) {
  return CPU_DIFFICULTIES[value === "normal" ? "medium" : value] || CPU_DIFFICULTIES.medium;
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
const categoryOf = (pokemon) => pokemon.isMythical || pokemon.rarity === "mythical"
  ? "mythical"
  : pokemon.isLegendary || pokemon.rarity === "legendary"
    ? "legendary"
    : pokemon.cpuTier || (power(pokemon) >= 590 ? "pseudo" : power(pokemon) >= 510 ? "powerful" : pokemon.evolutionStage === "basic" || power(pokemon) < 470 ? "basic" : "evolved");
const weightedPick = (entries, random) => {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight) || 0), 0);
  if (!total) return null;
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= Math.max(0, Number(entry.weight) || 0);
    if (cursor <= 0) return entry.value;
  }
  return entries.at(-1)?.value || null;
};

export function getCpuTeamPower(team = []) {
  return team.reduce((sum, pokemon) => sum + power(pokemon) + (Number(pokemon.level) || 1) * 12, 0);
}

function eligibleRoster(config) {
  const configured = CPU_ROSTER.filter((pokemon) => {
    if ((pokemon.source === "custom" || pokemon.isCustom) && !pokemon.cpuRandomEligible) return false;
    const category = categoryOf(pokemon);
    if (!(config.categoryWeights[category] > 0)) return false;
    const bst = power(pokemon);
    return (!config.minBst || bst >= config.minBst) && (!config.maxBst || bst <= config.maxBst);
  });
  // Keeps the pure generator usable by small development/test rosters while
  // production always uses the stricter configured pool above.
  return configured.length ? configured : CPU_ROSTER.filter((pokemon) => config.categoryWeights[categoryOf(pokemon)] > 0);
}

function scoreTeamCandidate(pokemon, selected, archetype, config, random) {
  const types = typeSet(pokemon);
  const chosenTypes = new Set(selected.flatMap((entry) => [...typeSet(entry)]));
  const duplicateTypes = [...types].filter((type) => chosenTypes.has(type)).length;
  const bst = power(pokemon);
  const category = categoryOf(pokemon);
  const categoryWeight = config.categoryWeights[category] || 0;
  const stat = pokemon.baseStats || {};
  const archetypeBonus = archetype === "fast" ? Number(stat.speed || 0) / 7
    : archetype === "defensive" ? (Number(stat.defense || 0) + Number(stat.specialDefense || 0)) / 14
      : archetype === "heavy-hitters" || archetype === "offensive" ? (Number(stat.attack || 0) + Number(stat.specialAttack || 0)) / 14
        : archetype === "status" && pokemon.abilityId ? 10 : 0;
  return categoryWeight * 30 + bst / 16 + archetypeBonus + types.size * 8 - duplicateTypes * 19 + random() * 10;
}

function chooseLevel({ averageLevel, config, teamBst, random }) {
  const [minimumOffset, maximumOffset] = config.levelRange;
  const powerAdjustment = config.id === "hard" && teamBst >= 1740 ? -1 : 0;
  return clampLevel(averageLevel + minimumOffset + Math.floor(random() * (maximumOffset - minimumOffset + 1)) + powerAdjustment);
}

/** A fair builder: it never inspects the player's types, only the selected difficulty. */
export function generateCpuTeam({ difficulty = "medium", playerTeam = [], recentTeams = [], random = Math.random } = {}) {
  const config = getCpuDifficulty(difficulty);
  const averageLevel = playerTeam.length
    ? playerTeam.reduce((sum, pokemon) => sum + Number(pokemon.level || 1), 0) / playerTeam.length
    : 1;
  const recent = new Set(recentTeams.map((team) => Array.isArray(team) ? teamKey(team) : String(team)));
  const candidates = shuffle(eligibleRoster(config), random);
  const selected = [];
  const archetype = weightedPick(config.archetypes.map((value) => ({ value, weight: 1 })), random) || "balanced";
  const [minimumBudget, maximumBudget] = config.teamBudget;

  while (selected.length < 3 && candidates.length) {
    const remainingSlots = 3 - selected.length;
    const hasRare = selected.some((pokemon) => ["legendary", "mythical"].includes(categoryOf(pokemon)));
    const chanceFiltered = candidates.filter((pokemon) => {
      const category = categoryOf(pokemon);
      if (!["legendary", "mythical"].includes(category)) return true;
      if (hasRare) return false;
      const chance = category === "mythical" ? config.mythicalSlotChance : config.legendarySlotChance;
      return random() < (chance || 0);
    });
    const ranked = (chanceFiltered.length ? chanceFiltered : candidates.filter((pokemon) => !["legendary", "mythical"].includes(categoryOf(pokemon))))
      .map((pokemon) => ({ pokemon, score: scoreTeamCandidate(pokemon, selected, archetype, config, random) }))
      .filter(({ pokemon }) => getCpuTeamPower(selected) + power(pokemon) <= maximumBudget + remainingSlots * 90)
      .sort((left, right) => right.score - left.score);
    const pool = ranked.length ? ranked.slice(0, Math.min(4, ranked.length)) : candidates.map((pokemon) => ({ pokemon }));
    const pick = pool[Math.floor(random() * pool.length)].pokemon;
    const level = chooseLevel({ averageLevel, config, teamBst: getCpuTeamPower([...selected, pick]), random });
    selected.push({ ...pick, types: [...pick.types], baseStats: { ...pick.baseStats }, level, cpuArchetype: archetype });
    candidates.splice(candidates.findIndex((candidate) => candidate.id === pick.id), 1);
  }

  // A reroll is only used to avoid the exact recent trio; the result is still frozen by the match creator.
  if (recent.has(teamKey(selected)) && candidates.length && getCpuTeamPower(selected) >= minimumBudget) {
    return generateCpuTeam({ difficulty, playerTeam, recentTeams: [], random });
  }
  return selected;
}

export function createCpuInventory(difficulty = "medium") {
  const config = getCpuDifficulty(difficulty);
  if (config.id === "easy") return {};
  if (config.id === "medium") return { "vital-potion": 1, "purifying-elixir": 1 };
  return { "vital-potion": 1, "purifying-elixir": 1, "instant-barrier": 1, stimulant: 1, "recharge-crystal": 1 };
}

function scoreMove(move, attacker, defender, config) {
  const resolution = calculateDamage({ attacker, defender, move, variance: 1 });
  const analysis = analyzeMoveDecision({ attacker, defender, move });
  const blockedByAbility = analysis.blockedByAbility;
  const damage = blockedByAbility ? 0 : resolution.damage;
  const attackType = move.type === "own" ? attacker.type : move.type;
  const effectiveness = getTypeEffectiveness(attackType, defender);
  const koBonus = damage >= defender.hp ? 180 : 0;
  const specialCost = move.special && attacker.specialAttackUsesRemaining <= config.specialReserve && damage < defender.hp ? (config.id === "hard" ? 26 : 10) : 0;
  const statusBonus = move.statusEffect && !defender.status ? (config.id === "easy" ? 3 : config.id === "medium" ? 13 : 20) : 0;
  const contactRisk = analysis.contactRisk ? (config.id === "hard" ? 42 : config.id === "medium" ? 15 : 0) : 0;
  const momentum = Number(attacker.momentum || 0);
  const momentumBonus = move.role === "FAST" && momentum < 3 ? config.momentumValue : move.role === "TECHNICAL" && momentum ? momentum * config.momentumValue : 0;
  return damage + effectiveness * (config.id === "easy" ? 5 : config.id === "medium" ? 17 : 24) + koBonus + statusBonus + momentumBonus - specialCost - contactRisk - (blockedByAbility ? 400 : 0);
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
  const canUse = (itemId) => !getBagItemUseBlockReason(active, itemId);
  if (active.status && bag["purifying-elixir"] && canUse("purifying-elixir") && config.id !== "easy")
    return { type: "item", itemId: "purifying-elixir", targetPokemonId: active.id };
  if (hp <= 0.32 && bag["vital-potion"] && canUse("vital-potion") && getPotionHealAmount(active) > 0)
    return { type: "potion", targetPokemonId: active.id };
  if (hp <= 0.45 && bag["instant-barrier"] && canUse("instant-barrier") && config.id === "hard")
    return { type: "item", itemId: "instant-barrier", targetPokemonId: active.id };
  if (bag.stimulant && canUse("stimulant") && config.id === "hard" && getHpRatio(state.host.team[state.host.active].hp, state.host.team[state.host.active].maxHp) <= 0.35)
    return { type: "item", itemId: "stimulant", targetPokemonId: active.id };
  return null;
}

/** Returns an engine action only. It never applies damage, mutates state, or predicts RNG. */
export function decideCpuIntent(state, { difficulty = "medium", random = Math.random } = {}) {
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
  const spread = config.id === "easy" ? Math.min(3, ranked.length) : config.id === "medium" ? Math.min(2, ranked.length) : Math.min(2, ranked.length);
  const picked = ranked[Math.floor(random() * spread)]?.move || moves[0];
  return { type: "attack", moveId: picked?.id || "strike" };
}

export function rollCpuItemDrop(difficulty = "medium", random = Math.random) {
  const config = getCpuDifficulty(difficulty);
  if (random() >= config.itemDropChance) return null;
  const rarity = config.id === "hard" && random() < 0.03
    ? "LEGENDARY"
    : config.itemRarities[Math.floor(random() * config.itemRarities.length)];
  const pool = ITEM_CATALOG.filter((item) => item.rarity === rarity);
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

export function createCpuVictoryReward(difficulty = "medium", random = Math.random) {
  const config = getCpuDifficulty(difficulty);
  const item = rollCpuItemDrop(config.id, random);
  return { difficulty: config.id, baseCoins: config.baseCoins, itemId: item?.id || null };
}

export const CPU_BAG_ITEM_IDS = Object.freeze(BAG_ITEM_CATALOG.map((item) => item.id));
