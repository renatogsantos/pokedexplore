// Local Pokémon are normalized to the same shape consumed by collection, shop
// and battle. `source` prevents resolvers from requesting an absent PokeAPI id.
export const ALICIA = Object.freeze({
  id: 10001,
  customId: "alicia",
  source: "custom",
  name: "alicia",
  displayName: "Alícia",
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
    {
      id: "luz-encantada",
      name: "Luz Encantada",
      type: "fairy",
      power: 100,
      accuracy: 100,
      damageClass: "special",
      special: true,
    },
    {
      id: "raio-lendario",
      name: "Raio Lendário",
      type: "electric",
      power: 82,
      accuracy: 100,
      damageClass: "special",
      special: false,
    },
    {
      id: "chama-celestial",
      name: "Chama Celestial",
      type: "fire",
      power: 84,
      accuracy: 100,
      damageClass: "special",
      special: false,
    },
    {
      id: "gelo-estelar",
      name: "Gelo Estelar",
      type: "ice",
      power: 84,
      accuracy: 100,
      damageClass: "special",
      special: false,
    },
  ],
});

export const ALYSSIA = Object.freeze({
  id: 10002,
  customId: "alyssia",
  source: "custom",
  name: "alyssia",
  displayName: "Alyssia",
  rarity: "legendary",
  isLegendary: true,
  isMythical: false,
  isCustom: true,
  type: "fairy",
  types: [{ slot: 1, type: { name: "fairy" } }, { slot: 2, type: { name: "psychic" } }],
  weaknesses: ["poison", "steel", "ghost"],
  height: 5,
  weight: 230,
  artwork: "/pokemons/alyssia.png",
  image: "/pokemons/alyssia.png",
  base_experience: 390,
  stats: [
    { base_stat: 160, stat: { name: "hp" } },
    { base_stat: 150, stat: { name: "attack" } },
    { base_stat: 140, stat: { name: "defense" } },
    { base_stat: 175, stat: { name: "special-attack" } },
    { base_stat: 155, stat: { name: "special-defense" } },
    { base_stat: 145, stat: { name: "speed" } },
  ],
  ability: "aura-da-alegria",
  moveset: [
    { id: "explosao-feerica", name: "Explosão Feérica", type: "fairy", power: 115, accuracy: 100, damageClass: "special", special: true },
    { id: "pulso-astral", name: "Pulso Astral", type: "psychic", power: 95, accuracy: 100, damageClass: "special", special: false },
    { id: "chama-encantada", name: "Chama Encantada", type: "fire", power: 90, accuracy: 100, damageClass: "special", special: false },
    { id: "raio-de-fada", name: "Raio de Fada", type: "electric", power: 90, accuracy: 100, damageClass: "special", special: false },
  ],
});

export const ALYSSIA_DARK = Object.freeze({
  id: 10003,
  customId: "alyssia-dark",
  source: "custom",

  name: "alyssia-dark",
  displayName: "Alyssia Sombria",

  rarity: "legendary",
  isLegendary: true,
  isMythical: false,
  isCustom: true,

  type: "dark",
  types: [
    { slot: 1, type: { name: "dark" } },
    { slot: 2, type: { name: "fairy" } },
  ],

  weaknesses: ["poison", "steel", "fairy"],

  height: 6,
  weight: 240,

  artwork: "/pokemons/alyssia-dark.png",
  image: "/pokemons/alyssia-dark.png",

  base_experience: 400,

  stats: [
    { base_stat: 155, stat: { name: "hp" } },
    { base_stat: 150, stat: { name: "attack" } },
    { base_stat: 140, stat: { name: "defense" } },
    { base_stat: 180, stat: { name: "special-attack" } },
    { base_stat: 150, stat: { name: "special-defense" } },
    { base_stat: 160, stat: { name: "speed" } },
  ],

  ability: "coracao-sombrio",

  moveset: [
    {
      id: "coracao-sombrio",
      name: "Coração Sombrio",
      type: "dark",
      power: 115,
      accuracy: 100,
      damageClass: "special",
      special: true,
    },
    {
      id: "explosao-feerica",
      name: "Explosão Feérica",
      type: "fairy",
      power: 105,
      accuracy: 100,
      damageClass: "special",
      special: false,
    },
    {
      id: "pulso-fantasma",
      name: "Pulso Fantasma",
      type: "ghost",
      power: 95,
      accuracy: 100,
      damageClass: "special",
      special: false,
    },
    {
      id: "beijo-do-caos",
      name: "Beijo do Caos",
      type: "dark",
      power: 90,
      accuracy: 100,
      damageClass: "special",
      special: false,
    },
  ],
});

export const CUSTOM_POKEMON_CATALOG = Object.freeze([
  ALICIA,
  ALYSSIA,
  ALYSSIA_DARK,
]);

export function getCustomPokemon(identifier) {
  const value = String(identifier || "").toLowerCase();
  return (
    CUSTOM_POKEMON_CATALOG.find(
      (pokemon) =>
        String(pokemon.id) === value ||
        pokemon.name === value ||
        pokemon.customId === value,
    ) || null
  );
}
