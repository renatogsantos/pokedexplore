import { ROUND, TOURNAMENT_MODE } from "./config.js";

export const TOURNAMENT_RESULT_STATE = Object.freeze({
  SEMIFINAL_ADVANCE: "SEMIFINAL_ADVANCE",
  SEMIFINAL_ELIMINATED: "SEMIFINAL_ELIMINATED",
  FINAL_CHAMPION: "FINAL_CHAMPION",
  FINALIST: "FINALIST",
});

export function getTournamentResultPresentation({ round, won, mode, receipt } = {}) {
  const hybrid = mode === TOURNAMENT_MODE.HYBRID;
  if (round === ROUND.SEMIFINAL && won) return { state: TOURNAMENT_RESULT_STATE.SEMIFINAL_ADVANCE, hybrid, receipt: null };
  if (round === ROUND.SEMIFINAL) return { state: TOURNAMENT_RESULT_STATE.SEMIFINAL_ELIMINATED, hybrid, receipt: receipt || null };
  if (won) return { state: TOURNAMENT_RESULT_STATE.FINAL_CHAMPION, hybrid, receipt: receipt || null };
  return { state: TOURNAMENT_RESULT_STATE.FINALIST, hybrid, receipt: receipt || null };
}
