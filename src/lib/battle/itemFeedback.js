// Local presentation only. Never writes to canonical battle state.
export const DISPLAY_DURATION = 1500;
export const EXIT_DURATION = 220;

export function getItemActivationEvents(effect, pokemon) {
  const events = [...(effect?.itemEvents || [])];
  if (effect?.kind === "item" && effect.itemId && String(effect.targetPokemonId) === String(pokemon.id))
    events.push({ itemId: effect.itemId, eventId: effect.eventId, pokemonId: pokemon.id, targetPokemonId: pokemon.id, remaining: effect.remaining, itemUsageCount: effect.itemUsageCount, itemUsageLimit: effect.itemUsageLimit, effect: { type: effect.healing ? "heal_hp" : "armed", amount: effect.healing || null } });
  return events.filter((event) => event?.itemId && [event.pokemonId, event.targetPokemonId].some((id) => id != null && String(id) === String(pokemon.id)));
}

export function createItemFeedbackScheduler(onChange, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const seen = new Set();
  let queue = [];
  let current = null;
  let timer = null;
  let generation = 0;
  function cancel() {
    generation += 1;
    if (timer != null) clearTimer(timer);
    timer = null;
    queue = [];
    current = null;
  }
  function next() {
    current = queue.shift() || null;
    onChange(current ? { ...current, phase: "visible" } : null);
    if (!current) return;
    const token = ++generation;
    timer = setTimer(() => {
      if (token !== generation) return;
      onChange({ ...current, phase: "exiting" });
      timer = setTimer(() => {
        if (token !== generation) return;
        timer = null;
        next();
      }, EXIT_DURATION);
    }, DISPLAY_DURATION - EXIT_DURATION);
  }
  return {
    enqueue(events, fallbackId) {
      for (const event of events) {
        const key = JSON.stringify([event.eventId || fallbackId, event.itemId, event.pokemonId, event.targetPokemonId, event.effect?.type]);
        if (seen.has(key)) continue;
        seen.add(key);
        queue.push({ event, key });
      }
      if (!current) next();
    },
    clear() { cancel(); onChange(null); },
    dispose() { cancel(); },
  };
}
