import { POKEMON_RARITY } from "./rarity";
import { CUSTOM_POKEMON_CATALOG } from "./customCatalog";

const DATA_URL = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv";
let catalogRequest;

function parseCsv(text) {
  const [header, ...rows] = text.trim().split(/\r?\n/);
  const keys = header.split(",");

  return rows.map((row) => {
    const values = row.split(",");
    return keys.reduce((record, key, index) => ({ ...record, [key]: values[index] }), {});
  });
}

const STAT_NAMES = Object.freeze({
  1: "hp",
  2: "attack",
  3: "defense",
  4: "special-attack",
  5: "special-defense",
  6: "speed",
});

function createCatalog([pokemonCsv, speciesCsv, statsCsv, pokemonTypesCsv, typesCsv]) {
  const species = new Map(parseCsv(speciesCsv).map((item) => [Number(item.id), item]));
  const stats = new Map();
  const typeNames = new Map(parseCsv(typesCsv).map((entry) => [Number(entry.id), entry.identifier]));
  const pokemonTypes = new Map();

  parseCsv(statsCsv).forEach((item) => {
    const id = Number(item.pokemon_id);
    const name = STAT_NAMES[Number(item.stat_id)];
    if (!name) return;
    stats.set(id, [...(stats.get(id) || []), { base_stat: Number(item.base_stat), stat: { name } }]);
  });

  parseCsv(pokemonTypesCsv).forEach((item) => {
    const id = Number(item.pokemon_id);
    const name = typeNames.get(Number(item.type_id));
    if (!name) return;
    pokemonTypes.set(id, [
      ...(pokemonTypes.get(id) || []),
      { slot: Number(item.slot) || 1, type: { name } },
    ]);
  });

  return parseCsv(pokemonCsv)
    .map((item) => {
      const specie = species.get(Number(item.species_id));
      const rarity = Number(specie?.is_mythical)
        ? POKEMON_RARITY.MYTHICAL
        : Number(specie?.is_legendary)
          ? POKEMON_RARITY.LEGENDARY
          : POKEMON_RARITY.NORMAL;

      const id = Number(item.id);
      const types = [...(pokemonTypes.get(id) || [])].sort((a, b) => a.slot - b.slot);
      return {
        id,
        name: item.identifier,
        rarity,
        base_experience: Number(item.base_experience) || 0,
        stats: stats.get(id) || [],
        types,
        artwork: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
      };
    })
    .filter((pokemon) => pokemon.id && pokemon.name && pokemon.stats.length && pokemon.types.length)
    .concat(CUSTOM_POKEMON_CATALOG);
}

export function getShopCatalog() {
  if (!catalogRequest) {
    catalogRequest = Promise.all([
      fetch(`${DATA_URL}/pokemon.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("pokemon-catalog"))),
      fetch(`${DATA_URL}/pokemon_species.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("species-catalog"))),
      fetch(`${DATA_URL}/pokemon_stats.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("stats-catalog"))),
      fetch(`${DATA_URL}/pokemon_types.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("pokemon-types-catalog"))),
      fetch(`${DATA_URL}/types.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("types-catalog"))),
    ]).then(createCatalog).catch((error) => {
      catalogRequest = undefined;
      throw error;
    });
  }

  return catalogRequest;
}
