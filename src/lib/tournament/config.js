export const TOURNAMENT_CONFIG = Object.freeze({
  playerCount: 4,
  codePrefix: "PKC",
  rewards: Object.freeze({ semifinal: 120, final: 500 }),
});

export const TOURNAMENT_STATUS = Object.freeze({ LOBBY: "LOBBY", SEMIFINALS: "SEMIFINALS", FINAL: "FINAL", FINISHED: "FINISHED", CANCELLED: "CANCELLED" });
export const MATCH_STATUS = Object.freeze({ WAITING: "WAITING", READY: "READY", PLAYING: "PLAYING", FINISHED: "FINISHED" });
export const ROUND = Object.freeze({ SEMIFINAL: "SEMIFINAL", FINAL: "FINAL" });

export const getTournamentReward = (round) => round === ROUND.FINAL ? TOURNAMENT_CONFIG.rewards.final : TOURNAMENT_CONFIG.rewards.semifinal;
export const getTournamentRewardId = (tournamentId, matchId, playerId) => `tournament:${tournamentId}:match:${matchId}:winner:${playerId}`;
