export const PVP_SELECTION_TIMING = Object.freeze({
  selectionSeconds: 60,
  urgencySeconds: 15,
});

export function createSelectionTiming(startedAt = Date.now(), timing = PVP_SELECTION_TIMING) {
  const selectionDeadline = startedAt + timing.selectionSeconds * 1000;
  return Object.freeze({
    id: `selection:${startedAt}`,
    startedAt,
    selectionDeadline,
    urgencyDeadline: selectionDeadline + timing.urgencySeconds * 1000,
  });
}

export function getSelectionTimerState(selectionTiming, now = Date.now()) {
  if (!selectionTiming?.selectionDeadline || !selectionTiming?.urgencyDeadline)
    return { phase: "idle", remainingSeconds: null };
  if (now < selectionTiming.selectionDeadline)
    return { phase: "selection", remainingSeconds: Math.max(0, Math.ceil((selectionTiming.selectionDeadline - now) / 1000)) };
  if (now < selectionTiming.urgencyDeadline)
    return { phase: "urgency", remainingSeconds: Math.max(0, Math.ceil((selectionTiming.urgencyDeadline - now) / 1000)) };
  return { phase: "expired", remainingSeconds: 0 };
}

export function completeSelection(collection = [], selected = []) {
  const byId = new Map(collection.map((pokemon) => [String(pokemon.id), pokemon]));
  const resolved = [];
  selected.forEach((pokemon) => {
    const current = byId.get(String(pokemon?.id));
    if (current && !resolved.some((item) => String(item.id) === String(current.id))) resolved.push(current);
  });
  collection.forEach((pokemon) => {
    if (resolved.length < 3 && !resolved.some((item) => String(item.id) === String(pokemon.id))) resolved.push(pokemon);
  });
  return resolved.slice(0, 3);
}

// Manual controls pass a click event; timeout resolution passes a Pokémon array.
export function getReadySelection(candidate, selected = []) {
  return Array.isArray(candidate) ? candidate : selected;
}
