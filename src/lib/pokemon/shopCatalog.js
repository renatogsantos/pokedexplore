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

function createCatalog([pokemonCsv, speciesCsv, statsCsv]) {
  const species = new Map(parseCsv(speciesCsv).map((item) => [Number(item.id), item]));
  const stats = new Map();

  parseCsv(statsCsv).forEach((item) => {
    const id = Number(item.pokemon_id);
    stats.set(id, [...(stats.get(id) || []), { base_stat: Number(item.base_stat) }]);
  });

  return parseCsv(pokemonCsv)
    .map((item) => {
      const specie = species.get(Number(item.species_id));
      const rarity = Number(specie?.is_mythical)
        ? POKEMON_RARITY.MYTHICAL
        : Number(specie?.is_legendary)
          ? POKEMON_RARITY.LEGENDARY
          : POKEMON_RARITY.NORMAL;

      return {
        id: Number(item.id),
        name: item.identifier,
        rarity,
        base_experience: Number(item.base_experience) || 0,
        stats: stats.get(Number(item.id)) || [],
      };
    })
    .filter((pokemon) => pokemon.id && pokemon.name && pokemon.stats.length)
    .concat(CUSTOM_POKEMON_CATALOG);
}

export function getShopCatalog() {
  if (!catalogRequest) {
    catalogRequest = Promise.all([
      fetch(`${DATA_URL}/pokemon.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("pokemon-catalog"))),
      fetch(`${DATA_URL}/pokemon_species.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("species-catalog"))),
      fetch(`${DATA_URL}/pokemon_stats.csv`).then((response) => response.ok ? response.text() : Promise.reject(new Error("stats-catalog"))),
    ]).then(createCatalog).catch((error) => {
      catalogRequest = undefined;
      throw error;
    });
  }

  return catalogRequest;
}
