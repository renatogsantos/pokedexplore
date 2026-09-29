export const TOURNAMENT_CONFIG = Object.freeze({
  playerCount: 4,
  codePrefix: "PKC",
  rewards: Object.freeze({
    semifinalist: Object.freeze({ coins: 4500, rarityLabel: "COMUM ou RARO" }),
    finalist: Object.freeze({ coins: 10000, rarityLabel: "RARO ou ÉPICO" }),
    champion: Object.freeze({ coins: 25000, rarityLabel: "ÉPICO garantido · 8% LENDÁRIO" }),
  }),
});
export const TOURNAMENT_MODE = Object.freeze({ NORMAL: "NORMAL", HYBRID: "HYBRID" });
export const TOURNAMENT_REWARD_MULTIPLIER = Object.freeze({ NORMAL: 1, HYBRID: 0.5 });

export const TOURNAMENT_STATUS = Object.freeze({
  LOBBY: "LOBBY",
  SEMIFINALS: "SEMIFINALS",
  FINAL: "FINAL",
  FINISHED: "FINISHED",
  CANCELLED: "CANCELLED",
});
export const MATCH_STATUS = Object.freeze({
  WAITING: "WAITING",
  READY: "READY",
  PLAYING: "PLAYING",
  FINISHED: "FINISHED",
});
export const ROUND = Object.freeze({ SEMIFINAL: "SEMIFINAL", FINAL: "FINAL" });

export const TOURNAMENT_PLACEMENT = Object.freeze({
  SEMIFINALIST: "SEMIFINALIST",
  FINALIST: "FINALIST",
  CHAMPION: "CHAMPION",
});

export const getTournamentRewardTier = (placement) =>
  TOURNAMENT_CONFIG.rewards[String(placement || "").toLowerCase()] || null;

export const getTournamentReward = (round) =>
  round === ROUND.FINAL
    ? TOURNAMENT_CONFIG.rewards.champion.coins
    : TOURNAMENT_CONFIG.rewards.finalist.coins;
export const getTournamentRewardId = (tournamentId, matchId, playerId) =>
  `tournament:${tournamentId}:match:${matchId}:winner:${playerId}`;
