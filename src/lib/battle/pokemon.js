export function getPokemonArtwork(pokemon) {
  return pokemon?.artwork || pokemon?.sprites?.other?.["official-artwork"]?.front_default || pokemon?.sprites?.other?.home?.front_default || pokemon?.sprites?.front_default || "/pokenull.png";
}

export function getHomeShinySprite(pokemon) {
  return pokemon?.homeShinySprite || pokemon?.sprites?.other?.home?.front_shiny || null;
}

export function getHomeDefaultSprite(pokemon) {
  return pokemon?.homeDefaultSprite || pokemon?.sprites?.other?.home?.front_default || null;
}

export function getReserveSprite(pokemon) {
  return getHomeShinySprite(pokemon) || getHomeDefaultSprite(pokemon) || pokemon?.animatedShiny || pokemon?.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_shiny || getPokemonArtwork(pokemon);
}

export function getPokemonType(pokemon) {
  return pokemon?.type || pokemon?.types?.[0]?.type?.name || "normal";
}

export function getPokemonTypes(pokemon) {
  if (Array.isArray(pokemon?.types)) return pokemon.types.map((type) => typeof type === "string" ? type : type.type?.name || type.name).filter(Boolean);
  return [getPokemonType(pokemon)];
}

export function getPokemonHp(pokemon) {
  return pokemon?.maxHp || pokemon?.stats?.find((stat) => stat.stat?.name === "hp")?.base_stat || 90;
}

export function toBattlePokemon(pokemon) {
  const level = getPokemonLevel(pokemon);
  const baseStats = getBaseStats(pokemon);
  const levelStat = (stat) => calculateLeveledStat(baseStats[stat] || 50, level);
  const maxHp = calculateLeveledStat(baseStats.hp || getPokemonHp(pokemon), level);
  return {
    id: pokemon.id,
    name: pokemon.name,
    type: getPokemonType(pokemon),
    types: getPokemonTypes(pokemon),
    level,
    baseStats,
    attackMultiplier: getStatMultiplier(level),
    stats: { attack: levelStat("attack"), defense: levelStat("defense"), specialAttack: levelStat("specialAttack"), specialDefense: levelStat("specialDefense"), speed: levelStat("speed") },
    artwork: getPokemonArtwork(pokemon),
    homeShinySprite: getHomeShinySprite(pokemon),
    homeDefaultSprite: getHomeDefaultSprite(pokemon),
    animatedShiny: getReserveSprite(pokemon),
    rarity: pokemon.rarity || "normal",
    ability: pokemon.ability || pokemon.abilities?.find((entry) => !entry.is_hidden)?.ability?.name || null,
    heldItem: pokemon.heldItem || null,
    moveset: pokemon.moveset || [],
    maxHp,
    hp: maxHp,
  };
}

export const CPU_TEAM = [
  { id: 7, name: "squirtle", type: "water", types: ["water"], level: 1, baseStats: { hp: 88, attack: 48 }, maxHp: 88, hp: 88, artwork: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png" },
  { id: 1, name: "bulbasaur", type: "grass", types: ["grass", "poison"], level: 1, baseStats: { hp: 92, attack: 49 }, maxHp: 92, hp: 92, artwork: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png" },
  { id: 4, name: "charmander", type: "fire", types: ["fire"], level: 1, baseStats: { hp: 84, attack: 52 }, maxHp: 84, hp: 84, artwork: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png" },
];
import { calculateLeveledStat, getBaseStats, getPokemonLevel, getStatMultiplier } from "@/lib/pokemon/progression";
