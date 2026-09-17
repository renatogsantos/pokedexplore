export const HELD_ITEM_CATALOG = Object.freeze([
  Object.freeze({ id: "oran", name: "Berry Oran", description: "Recupera 20% do HP após receber dano e ficar com 50% do HP ou menos.", price: 45, category: "held", quantityLabel: "disponível", consumable: true }),
  Object.freeze({ id: "sitrus", name: "Berry Sitrus", description: "Recupera 30% do HP após receber dano e ficar com 50% do HP ou menos.", price: 80, category: "held", quantityLabel: "disponível", consumable: true }),
  Object.freeze({ id: "type-boost", name: "Amplificador de tipo", description: "Aumenta em 10% os golpes do tipo principal do Pokémon equipado.", price: 120, category: "held", quantityLabel: "disponível", consumable: false }),
]);

const HELD_ITEM_IDS = new Set(HELD_ITEM_CATALOG.map((item) => item.id));

export function getHeldItemDefinition(item) {
  const id = getHeldItemInventoryId(item);
  return HELD_ITEM_CATALOG.find((entry) => entry.id === id) || null;
}

export function getHeldItemInventoryId(item) {
  const value = typeof item === "string" ? item.trim().toLowerCase() : "";
  if (!value) return null;
  if (value === "type-boost" || value.endsWith("-boost")) return "type-boost";
  return HELD_ITEM_IDS.has(value) ? value : null;
}

export function getPokemonPrimaryType(pokemon) {
  return pokemon?.types?.[0]?.type?.name || pokemon?.types?.[0]?.name || pokemon?.types?.[0] || pokemon?.type || "normal";
}

export function toStoredHeldItem(item, pokemon) {
  const id = getHeldItemInventoryId(item);
  if (!id) return null;
  return id === "type-boost" ? `${getPokemonPrimaryType(pokemon)}-boost` : id;
}

export function normalizePokemonHeldItem(pokemon) {
  const legacyValue = pokemon?.heldItem ?? pokemon?.held_item ?? pokemon?.equippedItem ?? pokemon?.equipped_item ?? pokemon?.item ?? null;
  return toStoredHeldItem(legacyValue, pokemon);
}

export function getHeldItemStock({ economy, collection, itemId }) {
  const id = getHeldItemInventoryId(itemId);
  if (!id) return { itemId: null, owned: 0, equipped: 0, available: 0 };
  const owned = Math.max(0, Math.floor(Number(economy?.inventory?.[id]) || 0));
  const equipped = (collection || []).filter((pokemon) => getHeldItemInventoryId(normalizePokemonHeldItem(pokemon)) === id).length;
  return { itemId: id, owned, equipped, available: Math.max(0, owned - equipped) };
}

export function validateHeldItemAssignments({ economy, collection }) {
  return HELD_ITEM_CATALOG.map((item) => getHeldItemStock({ economy, collection, itemId: item.id })).filter((stock) => stock.equipped > stock.owned);
}

export function planHeldItemChange({ pokemonId, requestedItem, economy, collection }) {
  const normalizedCollection = (collection || []).map((pokemon) => ({ ...pokemon, heldItem: normalizePokemonHeldItem(pokemon) }));
  const pokemon = normalizedCollection.find((entry) => String(entry.id) === String(pokemonId));
  if (!pokemon) return { ok: false, reason: "pokemon-not-found" };

  const previousHeldItem = pokemon.heldItem || null;
  if (!requestedItem) {
    return { ok: true, pokemon: { ...pokemon, heldItem: null }, previousHeldItem, heldItem: null, economy, collection: normalizedCollection };
  }

  const definition = getHeldItemDefinition(requestedItem);
  if (!definition || definition.category !== "held") return { ok: false, reason: "invalid-item", pokemon, previousHeldItem };
  const heldItem = toStoredHeldItem(requestedItem, pokemon);
  if (heldItem === previousHeldItem) return { ok: true, unchanged: true, pokemon, previousHeldItem, heldItem, economy, collection: normalizedCollection };

  const otherPokemon = normalizedCollection.filter((entry) => String(entry.id) !== String(pokemon.id));
  const stock = getHeldItemStock({ economy, collection: otherPokemon, itemId: definition.id });
  if (stock.available <= 0) return { ok: false, reason: "not-available", pokemon, previousHeldItem, heldItem, stock };

  const nextPokemon = { ...pokemon, heldItem };
  return {
    ok: true,
    pokemon: nextPokemon,
    previousHeldItem,
    heldItem,
    economy,
    stock,
    collection: normalizedCollection.map((entry) => String(entry.id) === String(nextPokemon.id) ? nextPokemon : entry),
  };
}
