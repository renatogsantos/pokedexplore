import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";

export function getPokemonArtwork(pokemon) { return getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.GENERAL }); }

export function getHomeShinySprite(pokemon) {
  return pokemon?.homeShinySprite || pokemon?.sprites?.other?.home?.front_shiny || null;
}

export function getHomeDefaultSprite(pokemon) {
  return pokemon?.homeDefaultSprite || pokemon?.sprites?.other?.home?.front_default || null;
}

export function getReserveSprite(pokemon) { return getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.BATTLE_THUMBNAIL }); }

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
    sprites: pokemon.sprites,
    visuals: pokemon.visuals,
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

const cpuPokemon = (id, name, type, types, baseStats) => ({ id, name, type, types, level: 1, baseStats, maxHp: baseStats.hp, hp: baseStats.hp, artwork: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` });

export const CPU_ROSTER = Object.freeze([
  cpuPokemon(1, "bulbasaur", "grass", ["grass", "poison"], { hp: 92, attack: 49, defense: 49, specialAttack: 65, specialDefense: 65, speed: 45 }),
  cpuPokemon(4, "charmander", "fire", ["fire"], { hp: 84, attack: 52, defense: 43, specialAttack: 60, specialDefense: 50, speed: 65 }),
  cpuPokemon(7, "squirtle", "water", ["water"], { hp: 88, attack: 48, defense: 65, specialAttack: 50, specialDefense: 64, speed: 43 }),
  cpuPokemon(19, "rattata", "normal", ["normal"], { hp: 80, attack: 56, defense: 35, specialAttack: 25, specialDefense: 35, speed: 72 }),
  cpuPokemon(25, "pikachu", "electric", ["electric"], { hp: 70, attack: 55, defense: 40, specialAttack: 50, specialDefense: 50, speed: 90 }),
  cpuPokemon(27, "sandshrew", "ground", ["ground"], { hp: 80, attack: 75, defense: 85, specialAttack: 20, specialDefense: 30, speed: 40 }),
  cpuPokemon(41, "zubat", "poison", ["poison", "flying"], { hp: 80, attack: 45, defense: 35, specialAttack: 30, specialDefense: 40, speed: 55 }),
  cpuPokemon(54, "psyduck", "water", ["water"], { hp: 100, attack: 52, defense: 48, specialAttack: 65, specialDefense: 50, speed: 55 }),
  cpuPokemon(66, "machop", "fighting", ["fighting"], { hp: 90, attack: 80, defense: 50, specialAttack: 35, specialDefense: 35, speed: 35 }),
  cpuPokemon(74, "geodude", "rock", ["rock", "ground"], { hp: 90, attack: 80, defense: 100, specialAttack: 30, specialDefense: 30, speed: 20 }),
  cpuPokemon(92, "gastly", "ghost", ["ghost", "poison"], { hp: 60, attack: 35, defense: 30, specialAttack: 100, specialDefense: 35, speed: 80 }),
  cpuPokemon(95, "onix", "rock", ["rock", "ground"], { hp: 70, attack: 45, defense: 160, specialAttack: 30, specialDefense: 45, speed: 70 }),
]);

export const CPU_TEAM = CPU_ROSTER.slice(0, 3);
import { calculateLeveledStat, getBaseStats, getPokemonLevel, getStatMultiplier } from "@/lib/pokemon/progression";
