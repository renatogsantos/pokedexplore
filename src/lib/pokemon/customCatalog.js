// Local Pokémon are normalized to the same shape consumed by collection, shop
// and battle. `source` prevents resolvers from requesting an absent PokeAPI id.
export const ALICIA = Object.freeze({
  id: 10001,
  customId: "alicia",
  source: "custom",
  name: "alicia",
  displayName: "Alicia",
  rarity: "legendary",
  isLegendary: true,
  isMythical: false,
  isCustom: true,
  type: "fairy",
  types: [{ slot: 1, type: { name: "fairy" } }],
  weaknesses: ["poison", "steel"],
  height: 5,
  weight: 230,
  artwork: "/pokemons/alicia.png",
  image: "/pokemons/alicia.png",
  base_experience: 340,
  stats: [
    { base_stat: 150, stat: { name: "hp" } },
    { base_stat: 145, stat: { name: "attack" } },
    { base_stat: 135, stat: { name: "defense" } },
    { base_stat: 160, stat: { name: "special-attack" } },
    { base_stat: 145, stat: { name: "special-defense" } },
    { base_stat: 130, stat: { name: "speed" } },
  ],
  ability: "quatro-elementos",
  moveset: [
    { id: "luz-encantada", name: "Luz Encantada", type: "fairy", power: 100, accuracy: 100, damageClass: "special", special: true },
    { id: "raio-lendario", name: "Raio Lendário", type: "electric", power: 82, accuracy: 100, damageClass: "special", special: false },
    { id: "chama-celestial", name: "Chama Celestial", type: "fire", power: 84, accuracy: 100, damageClass: "special", special: false },
    { id: "gelo-estelar", name: "Gelo Estelar", type: "ice", power: 84, accuracy: 100, damageClass: "special", special: false },
  ],
});

export const CUSTOM_POKEMON_CATALOG = Object.freeze([ALICIA]);

export function getCustomPokemon(identifier) {
  const value = String(identifier || "").toLowerCase();
  return CUSTOM_POKEMON_CATALOG.find((pokemon) => String(pokemon.id) === value || pokemon.name === value || pokemon.customId === value) || null;
}
