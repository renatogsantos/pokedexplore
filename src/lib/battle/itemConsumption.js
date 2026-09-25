// Converts an authoritative battle effect into the small, persistent changes
// owned by one local player. The engine is the only producer of these effects;
// UI code must not infer consumption from HP, labels, or the final result.
export function getItemConsumptionEvents(state, localRole) {
  const effect = state?.effect;
  const ownerPlayerId = state?.[localRole]?.id || null;
  if (!effect || !state?.matchId || !localRole) return [];

  const events = [];
  if (effect.kind === "item" && effect.actor === localRole && effect.result?.consumed) {
    events.push({
      type: "ITEM_CONSUMED",
      usageType: "BAG",
      ownerRole: localRole,
      ownerPlayerId,
      itemId: effect.itemId,
      eventId: effect.eventId || `bag:${state.revision}:${effect.itemId}`,
      consumptionId: `${state.matchId}:bag:${localRole}:${effect.eventId || `${state.revision}:${effect.itemId}`}`,
    });
  }

  const heldItemEvents = effect.itemEvents || (effect.heldItem ? [effect.heldItem] : []);
  for (const item of heldItemEvents) {
    if (!item?.consumed || item.owner !== localRole || !item.itemId || !item.pokemonId)
      continue;
    const eventId = item.eventId || `${state.revision}:${item.pokemonId}:${item.itemId}`;
    events.push({
      type: "ITEM_CONSUMED",
      usageType: "HELD",
      ownerRole: localRole,
      ownerPlayerId,
      itemId: item.itemId,
      pokemonInstanceId: item.pokemonId,
      eventId,
      consumptionId: `${state.matchId}:held:${localRole}:${item.pokemonId}:${item.itemId}:${eventId}`,
    });
  }
  return events;
}
