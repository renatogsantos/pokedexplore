export const POKEMON_RARITY = { NORMAL: "normal", LEGENDARY: "legendary", MYTHICAL: "mythical" };
const cache = new Map();

export function getPokemonRarity(pokemon) {
  return pokemon?.rarity === POKEMON_RARITY.LEGENDARY || pokemon?.isLegendary ? POKEMON_RARITY.LEGENDARY : pokemon?.rarity === POKEMON_RARITY.MYTHICAL || pokemon?.isMythical ? POKEMON_RARITY.MYTHICAL : POKEMON_RARITY.NORMAL;
}

export function hasResolvedPokemonRarity(pokemon) { return Boolean(pokemon?.rarity); }
export function getPokemonRarityPresentation(pokemon) {
  const rarity = getPokemonRarity(pokemon);
  return rarity === POKEMON_RARITY.LEGENDARY ? { rarity, label: "Lendário", className: "rarity-legendary" } : rarity === POKEMON_RARITY.MYTHICAL ? { rarity, label: "Mítico", className: "rarity-mythical" } : { rarity, label: "", className: "rarity-normal" };
}

export async function enrichPokemonRarity(pokemon) {
  if (!pokemon || hasResolvedPokemonRarity(pokemon)) return pokemon;
  const key = pokemon.id || pokemon.name || pokemon.species?.name;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    let rarity = cache.get(key);
    if (!rarity) {
      const speciesUrl = pokemon.species?.url || `https://pokeapi.co/api/v2/pokemon-species/${pokemon.id || pokemon.name}`;
      const response = await fetch(speciesUrl, { signal: controller.signal });
      if (!response.ok) throw new Error("Species unavailable");
      const species = await response.json();
      rarity = species.is_mythical ? POKEMON_RARITY.MYTHICAL : species.is_legendary ? POKEMON_RARITY.LEGENDARY : POKEMON_RARITY.NORMAL;
      cache.set(key, rarity);
    }
    return { ...pokemon, rarity };
  } catch {
    // Unavailable metadata is not proof of NORMAL rarity. Leave unresolved so
    // a later read can repair it rather than permanently misclassifying a save.
    return pokemon;
  } finally { clearTimeout(timeout); }
}
