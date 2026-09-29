import assert from "node:assert/strict";
import test from "node:test";
import { TOURNAMENT_MATCH_KIND } from "./match.js";
import { isValidTournamentCpuTeam, prepareTournamentCpuOpponent } from "./cpu.js";

const team = [{ id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }];
test("CPU tournament preparation reuses a valid frozen team", async () => {
  let generated = false;
  const result = await prepareTournamentCpuOpponent({ match: { cpu_team: team }, matchKind: TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU, generateTeam: () => { generated = true; return team; }, freezeTeam: () => team });
  assert.equal(result.source, "persisted"); assert.equal(generated, false);
});
test("CPU tournament preparation reaches READY or rejects instead of remaining loading", async () => {
  const ready = await prepareTournamentCpuOpponent({ match: {}, matchKind: TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU, generateTeam: () => team, freezeTeam: () => team });
  assert.equal(ready.status, "READY"); assert.equal(isValidTournamentCpuTeam(ready.team), true);
  await assert.rejects(() => prepareTournamentCpuOpponent({ match: {}, matchKind: TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU, generateTeam: () => [], freezeTeam: () => team }));
});
