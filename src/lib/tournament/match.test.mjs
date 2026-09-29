import assert from "node:assert/strict";
import test from "node:test";
import { canStartTournamentPrebattle, chooseCpuVsCpuWinner, getTournamentMatchKind, TOURNAMENT_MATCH_KIND } from "./match.js";

const tournament = { tournament_players: [
  { player_id: "human-a", is_cpu: false }, { player_id: "human-b", is_cpu: false },
  { player_id: "cpu-a", is_cpu: true }, { player_id: "cpu-b", is_cpu: true },
] };

test("classifies hybrid match participants from persisted player roles", () => {
  assert.equal(getTournamentMatchKind(tournament, { player1_id: "human-a", player2_id: "human-b" }), TOURNAMENT_MATCH_KIND.HUMAN_VS_HUMAN);
  assert.equal(getTournamentMatchKind(tournament, { player1_id: "human-a", player2_id: "cpu-a" }), TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU);
  assert.equal(getTournamentMatchKind(tournament, { player1_id: "cpu-a", player2_id: "cpu-b" }), TOURNAMENT_MATCH_KIND.CPU_VS_CPU);
});

test("CPU versus CPU selection is a deterministic 50/50 branch when injected", () => {
  const match = { player1_id: "cpu-a", player2_id: "cpu-b" };
  assert.equal(chooseCpuVsCpuWinner(match, () => 0.49), "cpu-a");
  assert.equal(chooseCpuVsCpuWinner(match, () => 0.5), "cpu-b");
});

test("prebattle readiness keeps human realtime requirements separate from CPU readiness", () => {
  const team = [{}, {}, {}];
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.HUMAN_VS_HUMAN, localTeam: team, remoteTeam: team, localReady: true, remoteReady: true }), false);
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.HUMAN_VS_HUMAN, localTeam: team, remoteTeam: team, realtimeConnected: true, localReady: true, remoteReady: false }), false);
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.HUMAN_VS_HUMAN, localTeam: team, remoteTeam: team, realtimeConnected: true, localReady: true, remoteReady: true }), true);
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU, localTeam: team, cpuTeam: null }), false);
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU, localTeam: [{}, {}], cpuTeam: team }), false);
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU, localTeam: team, cpuTeam: team }), true);
  assert.equal(canStartTournamentPrebattle({ kind: TOURNAMENT_MATCH_KIND.CPU_VS_CPU, localTeam: team, cpuTeam: team }), false);
});
