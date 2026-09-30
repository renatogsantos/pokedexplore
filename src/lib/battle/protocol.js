const STATUS_ORDER = Object.freeze({ countdown: 0, playing: 1, finished: 2 });

export function canApplyBattleSnapshot(previous, incoming, { localRole, playerId, retiredMatchIds } = {}) {
  if (localRole !== "guest" || !incoming?.matchId || !Object.hasOwn(STATUS_ORDER, incoming.status) || !Number.isInteger(incoming.revision)) return false;
  if (incoming.guest?.id !== playerId || incoming.host?.id === playerId) return false;
  if (retiredMatchIds?.has(incoming.matchId)) return false;
  if (!previous) return true;
  if (previous.matchId !== incoming.matchId) return false;
  const revision = Number(incoming.revision);
  const currentRevision = Number(previous.revision);
  if (!Number.isInteger(revision) || revision < currentRevision) return false;
  if (revision > currentRevision) return true;
  return STATUS_ORDER[incoming.status] > STATUS_ORDER[previous.status];
}

export function canResolveRemoteAction(state, action) {
  return Boolean(state?.matchId && state.status === "playing" && state.turn === "guest" &&
    action?.matchId === state.matchId && action.expectedRevision === state.revision &&
    typeof action.actionId === "string" && action.actionId.length > 0);
}
