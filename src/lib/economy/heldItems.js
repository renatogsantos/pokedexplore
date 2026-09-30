import {
  ELEMENTAL_RELICS_BY_TYPE,
  ELEMENTAL_RELIC_CATALOG,
  HELD_ITEM_CATALOG,
  STRATEGIC_ITEM_CATALOG,
  getItemDefinition,
  migrateLegacyItemId,
} from "@/lib/items/catalog";

export { HELD_ITEM_CATALOG };
export const EQUIPMENT_SLOT = Object.freeze({ STRATEGIC: "STRATEGIC", ELEMENTAL_RELIC: "ELEMENTAL_RELIC" });

export function getEquipmentSlot(itemOrId) {
  const item = typeof itemOrId === "string" ? getItemDefinition(itemOrId) : itemOrId;
  return item?.usageType === "HELD" ? item.equipmentSlot || EQUIPMENT_SLOT.STRATEGIC : null;
}

export function getHeldItemInventoryId(item) {
  const id = migrateLegacyItemId(typeof item === "string" ? item : item?.id);
  return getItemDefinition(id)?.usageType === "HELD" ? id : null;
}

export function getHeldItemDefinition(item) {
  const definition = getItemDefinition(getHeldItemInventoryId(item));
  return definition?.usageType === "HELD" ? definition : null;
}

export function getPokemonTypes(pokemon) {
  const source = pokemon?.types;
  const rawTypes = Array.isArray(source) && source.length ? source : source && typeof source === "object" ? (source.type ? [source] : Object.values(source)) : [pokemon?.type];
  const normalized = rawTypes.map((type) => String(type?.type?.name || type?.name || type || "").trim().toLowerCase()).filter(Boolean);
  return normalized.length ? normalized : [pokemon?.type].map((type) => String(type?.name || type || "").trim().toLowerCase()).filter(Boolean);
}

export function canEquipElementalRelic(pokemon, relicOrId) {
  const relic = getHeldItemDefinition(relicOrId);
  if (getEquipmentSlot(relic) !== EQUIPMENT_SLOT.ELEMENTAL_RELIC) return { allowed: false, reason: "NOT_ELEMENTAL_RELIC" };
  return getPokemonTypes(pokemon).includes(String(relic.elementalType || "").toLowerCase()) ? { allowed: true } : { allowed: false, reason: "TYPE_MISMATCH" };
}

// Static catalog indexes make selector opening proportional to the selected
// Pokemon's types, not to the whole item catalog.
export function getEquipableItemsForSlot({ pokemon, slot }) {
  if (slot === EQUIPMENT_SLOT.STRATEGIC) return STRATEGIC_ITEM_CATALOG;
  if (slot !== EQUIPMENT_SLOT.ELEMENTAL_RELIC) return [];
  return getPokemonTypes(pokemon).map((type) => ELEMENTAL_RELICS_BY_TYPE[type]).filter(Boolean);
}

export function normalizePokemonEquipment(pokemon = {}) {
  const legacy = getHeldItemInventoryId(pokemon.heldItem ?? pokemon.held_item ?? pokemon.equippedItem ?? pokemon.equipped_item ?? pokemon.item);
  const strategic = getHeldItemInventoryId(pokemon.strategicItem ?? pokemon.strategic_item);
  const relic = getHeldItemInventoryId(pokemon.elementalRelic ?? pokemon.elemental_relic);
  const legacySlot = getEquipmentSlot(legacy);
  return {
    strategicItem: getEquipmentSlot(strategic) === EQUIPMENT_SLOT.STRATEGIC ? strategic : legacySlot === EQUIPMENT_SLOT.STRATEGIC ? legacy : null,
    elementalRelic: getEquipmentSlot(relic) === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? relic : legacySlot === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? legacy : null,
  };
}

export function normalizePokemonHeldItem(pokemon) { return normalizePokemonEquipment(pokemon).strategicItem; }
export function getPokemonStrategicItem(pokemon) { return normalizePokemonEquipment(pokemon).strategicItem; }
export function getPokemonElementalRelic(pokemon) { return normalizePokemonEquipment(pokemon).elementalRelic; }
export function toStoredHeldItem(item) { return getHeldItemInventoryId(item); }

// One collection pass replaces item-card × collection scans. The index is a
// short-lived view of the caller's current snapshot; it is never persisted.
export function buildEquipmentReservationIndex(collection = []) {
  const counts = new Map();
  for (const pokemon of collection) {
    const equipment = normalizePokemonEquipment(pokemon);
    for (const itemId of [equipment.strategicItem, equipment.elementalRelic]) {
      if (itemId) counts.set(itemId, (counts.get(itemId) || 0) + 1);
    }
  }
  return counts;
}

export function getHeldItemStock({ economy, collection, itemId, reservationIndex }) {
  const id = getHeldItemInventoryId(itemId);
  if (!id) return { itemId: null, owned: 0, equipped: 0, available: 0 };
  const owned = Math.max(0, Math.floor(Number(economy?.inventory?.[id]) || 0));
  const equipped = reservationIndex ? (reservationIndex.get(id) || 0) : buildEquipmentReservationIndex(collection).get(id) || 0;
  return { itemId: id, owned, equipped, available: Math.max(0, owned - equipped) };
}

export function getEquipmentInventoryState({ economy, collection, pokemonId, pokemon, itemId, reservationIndex }) {
  const current = pokemon || (collection || []).find((entry) => String(entry.id) === String(pokemonId));
  const stock = getHeldItemStock({ economy, collection, itemId, reservationIndex });
  const equipment = normalizePokemonEquipment(current);
  const equippedOnCurrent = equipment.strategicItem === stock.itemId || equipment.elementalRelic === stock.itemId;
  const reservedByOthers = Math.max(0, stock.equipped - Number(equippedOnCurrent));
  const available = Math.max(0, stock.owned - reservedByOthers - Number(equippedOnCurrent));
  return { ...stock, equippedOnCurrent, reservedByOthers, available, state: equippedOnCurrent ? "CURRENTLY_EQUIPPED" : stock.owned === 0 ? "NOT_OWNED" : available > 0 ? "AVAILABLE" : "ALL_RESERVED" };
}

export function getEquipmentItemStates({ economy, collection, pokemon, slot, reservationIndex = buildEquipmentReservationIndex(collection) }) {
  return getEquipableItemsForSlot({ pokemon, slot }).map((item) => ({ item, ...getEquipmentInventoryState({ economy, collection, pokemon, itemId: item.id, reservationIndex }) }));
}

export function validateHeldItemAssignments({ economy, collection }) {
  const reservationIndex = buildEquipmentReservationIndex(collection);
  return HELD_ITEM_CATALOG.map((entry) => getHeldItemStock({ economy, collection, itemId: entry.id, reservationIndex })).filter((stock) => stock.equipped > stock.owned);
}

export function planHeldItemChange({ pokemonId, requestedItem, economy, collection, slot }) {
  const normalizedCollection = (collection || []).map((pokemon) => {
    const equipment = normalizePokemonEquipment(pokemon);
    return { ...pokemon, ...equipment, heldItem: equipment.strategicItem };
  });
  const pokemon = normalizedCollection.find((entry) => String(entry.id) === String(pokemonId));
  if (!pokemon) return { ok: false, reason: "pokemon-not-found" };
  const requestedDefinition = requestedItem ? getHeldItemDefinition(requestedItem) : null;
  const equipmentSlot = slot || getEquipmentSlot(requestedDefinition) || EQUIPMENT_SLOT.STRATEGIC;
  if (requestedItem && !requestedDefinition) return { ok: false, reason: "invalid-item", pokemon };
  if (requestedDefinition && getEquipmentSlot(requestedDefinition) !== equipmentSlot) return { ok: false, reason: "invalid-slot", pokemon };
  if (equipmentSlot === EQUIPMENT_SLOT.ELEMENTAL_RELIC && requestedItem && !canEquipElementalRelic(pokemon, requestedDefinition).allowed) return { ok: false, reason: "TYPE_MISMATCH", pokemon };
  const field = equipmentSlot === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? "elementalRelic" : "strategicItem";
  const previousHeldItem = pokemon[field] || null;
  if (!requestedItem) {
    const nextPokemon = { ...pokemon, [field]: null, heldItem: equipmentSlot === EQUIPMENT_SLOT.STRATEGIC ? null : pokemon.strategicItem };
    return { ok: true, pokemon: nextPokemon, previousHeldItem, heldItem: null, equipmentSlot, economy, collection: normalizedCollection.map((entry) => String(entry.id) === String(pokemon.id) ? nextPokemon : entry) };
  }
  const heldItem = requestedDefinition.id;
  if (heldItem === previousHeldItem) return { ok: true, unchanged: true, pokemon, previousHeldItem, heldItem, equipmentSlot, economy, collection: normalizedCollection };
  const reservationIndex = buildEquipmentReservationIndex(normalizedCollection.filter((entry) => String(entry.id) !== String(pokemon.id)));
  const stock = getHeldItemStock({ economy, itemId: heldItem, reservationIndex });
  if (stock.available <= 0) return { ok: false, reason: "not-available", pokemon, previousHeldItem, heldItem, stock };
  const nextPokemon = { ...pokemon, [field]: heldItem, heldItem: equipmentSlot === EQUIPMENT_SLOT.STRATEGIC ? heldItem : pokemon.strategicItem };
  return { ok: true, pokemon: nextPokemon, previousHeldItem, heldItem, equipmentSlot, economy, stock, collection: normalizedCollection.map((entry) => String(entry.id) === String(pokemon.id) ? nextPokemon : entry) };
}
