export const TOURNAMENT_MATCH_KIND = Object.freeze({
  HUMAN_VS_HUMAN: "HUMAN_VS_HUMAN",
  HUMAN_VS_CPU: "HUMAN_VS_CPU",
  CPU_VS_CPU: "CPU_VS_CPU",
});

export function getTournamentMatchKind(tournament, match) {
  const players = Array.isArray(tournament?.tournament_players)
    ? tournament.tournament_players
    : [];
  const participants = [match?.player1_id, match?.player2_id]
    .map((id) => players.find((player) => player.player_id === id))
    .filter(Boolean);
  if (participants.length !== 2) return null;
  const cpuCount = participants.filter((player) => player.is_cpu === true).length;
  if (cpuCount === 2) return TOURNAMENT_MATCH_KIND.CPU_VS_CPU;
  if (cpuCount === 1) return TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU;
  return TOURNAMENT_MATCH_KIND.HUMAN_VS_HUMAN;
}

// This is deliberately only for the simplified hybrid bracket. The persisted
// match update remains the single source of truth and makes a refresh harmless.
export function chooseCpuVsCpuWinner(match, random = Math.random) {
  if (!match?.player1_id || !match?.player2_id) return null;
  return random() < 0.5 ? match.player1_id : match.player2_id;
}

const hasTeamOfThree = (team) => Array.isArray(team) && team.length === 3;

export function canStartTournamentPrebattle({
  kind,
  localTeam,
  remoteTeam,
  realtimeConnected = false,
  localReady = false,
  remoteReady = false,
  cpuTeam,
} = {}) {
  if (kind === TOURNAMENT_MATCH_KIND.HUMAN_VS_HUMAN) {
    return realtimeConnected && localReady && remoteReady && hasTeamOfThree(localTeam) && hasTeamOfThree(remoteTeam);
  }
  if (kind === TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU) {
    return hasTeamOfThree(localTeam) && hasTeamOfThree(cpuTeam);
  }
  return false;
}
