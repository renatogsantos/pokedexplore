import assert from "node:assert/strict";
import test from "node:test";
import { ROUND } from "./config.js";
import { getTournamentResultPresentation, TOURNAMENT_RESULT_STATE } from "./presentation.js";

test("tournament result presentation separates semifinal advancement from settled placements", () => {
  assert.equal(getTournamentResultPresentation({ round: ROUND.SEMIFINAL, won: true }).state, TOURNAMENT_RESULT_STATE.SEMIFINAL_ADVANCE);
  assert.equal(getTournamentResultPresentation({ round: ROUND.SEMIFINAL, won: false, mode: "HYBRID", receipt: { coins: 1 } }).state, TOURNAMENT_RESULT_STATE.SEMIFINAL_ELIMINATED);
  assert.equal(getTournamentResultPresentation({ round: ROUND.FINAL, won: true }).state, TOURNAMENT_RESULT_STATE.FINAL_CHAMPION);
  assert.equal(getTournamentResultPresentation({ round: ROUND.FINAL, won: false }).state, TOURNAMENT_RESULT_STATE.FINALIST);
});
