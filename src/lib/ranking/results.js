import { POKEMON_MASTER_BONUS_COINS } from "@/lib/profile/pokemonMaster";

export const MASTER_REWARD_TYPE = "POKEMON_MASTER_BATTLE_BONUS";
export const MASTER_ELIGIBLE_MODES = Object.freeze(["CPU", "PVP", "JOURNEY"]);
const validId = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_:-]{2,127}$/.test(value);
const validMatch = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_:-]{2,159}$/.test(value);

export function validateCompetitiveEvent(event) {
  const time = Date.parse(event?.completedAt);
  return Boolean(event && validMatch(event.matchId) && validId(event.playerId)
    && MASTER_ELIGIBLE_MODES.includes(event.mode) && ["WIN", "LOSS"].includes(event.result)
    && Number.isFinite(time) && time > 0 && time <= Date.now() + 300000
    && (event.mode === "PVP" ? validId(event.opponentPlayerId) && event.opponentPlayerId !== event.playerId : event.opponentPlayerId === null));
}

// Only natural engine completion is eligible. Closing/disconnecting/forfeiting
// never creates this event. This is client integrity validation, NOT anti-cheat.
export function buildCompetitiveResult({ state, role, playerId, mode, journey = false }) {
  if (!state || state.status !== "finished" || !["host", "guest"].includes(role)
    || !["host", "guest"].includes(state.winner) || state[role]?.id !== playerId
    || state.abandoned || state.cancelled || state.forfeit || !(state.revision > 0)) return null;
  const rankedMode = journey && mode === "cpu" ? "JOURNEY" : mode === "cpu" ? "CPU" : ["friend", "pvp"].includes(mode) ? "PVP" : null;
  if (!rankedMode) return null; // Badge/tournament result triggers own their stats.
  const loser = state.winner === "host" ? "guest" : "host";
  const losingTeam = state[loser]?.team;
  const winningTeam = state[state.winner]?.team;
  if (!Array.isArray(losingTeam) || !losingTeam.length || !losingTeam.every(p => Number.isFinite(p.hp) && p.hp <= 0)
    || !Array.isArray(winningTeam) || !winningTeam.some(p => Number.isFinite(p.hp) && p.hp > 0)) return null;
  const { startedAt, endedAt } = state.performance || {};
  if (!Number.isFinite(startedAt) || startedAt <= 0 || !Number.isFinite(endedAt) || endedAt < startedAt) return null;
  const event = {
    matchId: state.matchId, playerId, mode: rankedMode,
    result: state.winner === role ? "WIN" : "LOSS",
    opponentPlayerId: rankedMode === "PVP" ? state[role === "host" ? "guest" : "host"]?.id : null,
    completedAt: new Date(endedAt).toISOString(),
  };
  return validateCompetitiveEvent(event) ? event : null;
}

export function validateMasterReceipt(receipt, event) {
  return Boolean(validateCompetitiveEvent(event) && receipt
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(receipt.id)
    && receipt.player_id === event.playerId && receipt.match_id === event.matchId
    && receipt.reward_type === MASTER_REWARD_TYPE && receipt.amount === POKEMON_MASTER_BONUS_COINS);
}
