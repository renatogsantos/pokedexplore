import { HELD_ITEM_CATALOG, getItemDefinition, migrateLegacyItemId } from "@/lib/items/catalog";

export { HELD_ITEM_CATALOG };

export function getHeldItemDefinition(item) {
  const id = getHeldItemInventoryId(item);
  const definition = getItemDefinition(id);
  return definition?.usageType === "HELD" ? definition : null;
}

export function getHeldItemInventoryId(item) {
  const id = migrateLegacyItemId(typeof item === "string" ? item : "");
  return getItemDefinition(id)?.usageType === "HELD" ? id : null;
}

export function getPokemonPrimaryType(pokemon) {
  return pokemon?.types?.[0]?.type?.name || pokemon?.types?.[0]?.name || pokemon?.types?.[0] || pokemon?.type || "normal";
}

export function toStoredHeldItem(item) { return getHeldItemInventoryId(item); }

export function normalizePokemonHeldItem(pokemon) {
  const legacyValue = pokemon?.heldItem ?? pokemon?.held_item ?? pokemon?.equippedItem ?? pokemon?.equipped_item ?? pokemon?.item ?? null;
  return toStoredHeldItem(legacyValue);
}

export function getHeldItemStock({ economy, collection, itemId }) {
  const id = getHeldItemInventoryId(itemId);
  if (!id) return { itemId: null, owned: 0, equipped: 0, available: 0 };
  const owned = Math.max(0, Math.floor(Number(economy?.inventory?.[id]) || 0));
  const equipped = (collection || []).filter((pokemon) => normalizePokemonHeldItem(pokemon) === id).length;
  return { itemId: id, owned, equipped, available: Math.max(0, owned - equipped) };
}

export function validateHeldItemAssignments({ economy, collection }) {
  return HELD_ITEM_CATALOG.map((entry) => getHeldItemStock({ economy, collection, itemId: entry.id })).filter((stock) => stock.equipped > stock.owned);
}

export function planHeldItemChange({ pokemonId, requestedItem, economy, collection }) {
  const normalizedCollection = (collection || []).map((pokemon) => ({ ...pokemon, heldItem: normalizePokemonHeldItem(pokemon) }));
  const pokemon = normalizedCollection.find((entry) => String(entry.id) === String(pokemonId));
  if (!pokemon) return { ok: false, reason: "pokemon-not-found" };
  const previousHeldItem = pokemon.heldItem || null;
  if (!requestedItem) return { ok: true, pokemon: { ...pokemon, heldItem: null }, previousHeldItem, heldItem: null, economy, collection: normalizedCollection.map((entry) => String(entry.id) === String(pokemon.id) ? { ...entry, heldItem: null } : entry) };
  const definition = getHeldItemDefinition(requestedItem);
  if (!definition) return { ok: false, reason: "invalid-item", pokemon, previousHeldItem };
  const heldItem = definition.id;
  if (heldItem === previousHeldItem) return { ok: true, unchanged: true, pokemon, previousHeldItem, heldItem, economy, collection: normalizedCollection };
  const otherPokemon = normalizedCollection.filter((entry) => String(entry.id) !== String(pokemon.id));
  const stock = getHeldItemStock({ economy, collection: otherPokemon, itemId: heldItem });
  if (stock.available <= 0) return { ok: false, reason: "not-available", pokemon, previousHeldItem, heldItem, stock };
  const nextPokemon = { ...pokemon, heldItem };
  return { ok: true, pokemon: nextPokemon, previousHeldItem, heldItem, economy, stock, collection: normalizedCollection.map((entry) => String(entry.id) === String(nextPokemon.id) ? nextPokemon : entry) };
}
