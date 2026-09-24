export const TRAINER_XP_REWARDS = Object.freeze({
  CPU_WIN: 20,
  PVP_WIN: 30,
  TOURNAMENT_WIN: 40,
  BADGE_BATTLE_WIN: 35,
});

export const PLAYER_BATTLE_MODES = Object.freeze(["cpu", "pvp", "tournament", "badge"]);

export function normalizeBattleMode(mode) {
  const value = String(mode || "cpu").toLowerCase();
  if (value.startsWith("badge")) return "badge";
  if (value === "tournament") return "tournament";
  if (["friend", "pvp", "multiplayer"].includes(value)) return "pvp";
  return "cpu";
}

export function getTrainerXpReward({ won, mode }) {
  if (!won) return 0;
  const normalizedMode = normalizeBattleMode(mode);
  if (normalizedMode === "badge") return TRAINER_XP_REWARDS.BADGE_BATTLE_WIN;
  if (normalizedMode === "tournament") return TRAINER_XP_REWARDS.TOURNAMENT_WIN;
  if (normalizedMode === "pvp") return TRAINER_XP_REWARDS.PVP_WIN;
  return TRAINER_XP_REWARDS.CPU_WIN;
}

export function getXpRequiredForLevel(level) {
  return Math.max(1, Math.floor(Number(level) || 1)) * 100;
}

export function getTotalXpForTrainerLevel(level) {
  const targetLevel = Math.max(1, Math.floor(Number(level) || 1));
  let totalXp = 0;
  for (let currentLevel = 1; currentLevel < targetLevel; currentLevel += 1) {
    totalXp += getXpRequiredForLevel(currentLevel);
  }
  return totalXp;
}

export function getTrainerProgress(totalXp = 0) {
  const xp = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  let levelStartXp = 0;
  let nextLevelXp = getXpRequiredForLevel(level);
  while (xp >= levelStartXp + nextLevelXp) {
    levelStartXp += nextLevelXp;
    level += 1;
    nextLevelXp = getXpRequiredForLevel(level);
  }
  const currentXp = xp - levelStartXp;
  return {
    totalXp: xp,
    level,
    currentXp,
    nextLevelXp,
    percent: Math.min(100, Math.round((currentXp / nextLevelXp) * 100)),
  };
}

export function createEmptyPlayerStats({ legacyWins = 0, legacyBattles = 0 } = {}) {
  const battlesCompleted = Math.max(0, Math.floor(Number(legacyBattles) || 0));
  const wins = Math.min(battlesCompleted, Math.max(0, Math.floor(Number(legacyWins) || 0)));
  return {
    battlesCompleted,
    wins,
    losses: Math.max(0, battlesCompleted - wins),
    byMode: Object.fromEntries(PLAYER_BATTLE_MODES.map((mode) => [mode, { battlesCompleted: 0, wins: 0, losses: 0 }])),
    processedBattleIds: [],
    includesLegacyAggregate: battlesCompleted > 0,
  };
}

export function normalizePlayerStats(stats, legacy = {}) {
  const base = stats || createEmptyPlayerStats(legacy);
  const battlesCompleted = Math.max(0, Math.floor(Number(base.battlesCompleted) || 0));
  const wins = Math.min(battlesCompleted, Math.max(0, Math.floor(Number(base.wins) || 0)));
  return {
    ...createEmptyPlayerStats(),
    ...base,
    battlesCompleted,
    wins,
    losses: Math.max(0, battlesCompleted - wins),
    byMode: Object.fromEntries(PLAYER_BATTLE_MODES.map((mode) => {
      const current = base.byMode?.[mode] || {};
      const modeBattles = Math.max(0, Math.floor(Number(current.battlesCompleted) || 0));
      const modeWins = Math.min(modeBattles, Math.max(0, Math.floor(Number(current.wins) || 0)));
      return [mode, { battlesCompleted: modeBattles, wins: modeWins, losses: modeBattles - modeWins }];
    })),
    processedBattleIds: [...new Set(base.processedBattleIds || [])].slice(-250),
  };
}

export function recordCompletedBattle(stats, { matchId, won, mode }) {
  const current = normalizePlayerStats(stats);
  const stableId = String(matchId || "").trim();
  if (!stableId || current.processedBattleIds.includes(stableId)) {
    return { recorded: false, stats: current, earnedXp: 0 };
  }
  const battleMode = normalizeBattleMode(mode);
  const modeStats = current.byMode[battleMode];
  const next = {
    ...current,
    battlesCompleted: current.battlesCompleted + 1,
    wins: current.wins + Number(Boolean(won)),
    losses: current.losses + Number(!won),
    byMode: {
      ...current.byMode,
      [battleMode]: {
        battlesCompleted: modeStats.battlesCompleted + 1,
        wins: modeStats.wins + Number(Boolean(won)),
        losses: modeStats.losses + Number(!won),
      },
    },
    processedBattleIds: [...current.processedBattleIds, stableId].slice(-250),
  };
  return { recorded: true, stats: next, earnedXp: getTrainerXpReward({ won, mode: battleMode }) };
}
