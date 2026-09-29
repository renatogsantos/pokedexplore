import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";
import { resolvePokemonAbilityId } from "@/lib/pokemon/progression";

export function getPokemonArtwork(pokemon) { return getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.GENERAL }); }

export function getHomeShinySprite(pokemon) {
  return pokemon?.homeShinySprite || pokemon?.sprites?.other?.home?.front_shiny || null;
}

export function getHomeDefaultSprite(pokemon) {
  return pokemon?.homeDefaultSprite || pokemon?.sprites?.other?.home?.front_default || null;
}

export function getShowdownThumbnail(pokemon) {
  return getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.BATTLE_THUMBNAIL });
}
export function getReserveSprite(pokemon) { return getShowdownThumbnail(pokemon); }

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
    source: pokemon.source || "pokeapi",
    customId: pokemon.customId || null,
    name: pokemon.name,
    displayName: pokemon.displayName || pokemon.name,
    type: getPokemonType(pokemon),
    types: getPokemonTypes(pokemon),
    level,
    baseStats,
    attackMultiplier: getStatMultiplier(level),
    stats: { attack: levelStat("attack"), defense: levelStat("defense"), specialAttack: levelStat("specialAttack"), specialDefense: levelStat("specialDefense"), speed: levelStat("speed") },
    artwork: getPokemonArtwork(pokemon),
    image: pokemon.image || null,
    imageUrl: pokemon.imageUrl || null,
    sprite: pokemon.sprite || null,
    sprites: pokemon.sprites,
    visuals: pokemon.visuals,
    homeShinySprite: getHomeShinySprite(pokemon),
    homeDefaultSprite: getHomeDefaultSprite(pokemon),
    animatedShiny: getReserveSprite(pokemon),
    rarity: pokemon.rarity || "normal",
    abilityId: resolvePokemonAbilityId(pokemon),
    ability: resolvePokemonAbilityId(pokemon),
    heldItem: pokemon.heldItem || null,
    moveset: pokemon.moveset || [],
    maxHp,
    hp: maxHp,
  };
}

const CPU_ABILITY_IDS = Object.freeze({ 1: "overgrow", 4: "blaze", 7: "torrent", 25: "static", 92: "levitate", 63: "synchronize" });
const cpuPokemon = (id, name, type, types, baseStats, metadata = {}) => ({ id, name, type, types, level: 1, baseStats, maxHp: baseStats.hp, hp: baseStats.hp, abilityId: metadata.abilityId || CPU_ABILITY_IDS[id] || null, rarity: metadata.rarity || "normal", evolutionStage: metadata.evolutionStage || "basic", cpuTier: metadata.cpuTier, isLegendary: Boolean(metadata.isLegendary), isMythical: Boolean(metadata.isMythical), cpuRandomEligible: metadata.cpuRandomEligible !== false, artwork: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png` });

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
  cpuPokemon(16, "pidgey", "flying", ["normal", "flying"], { hp: 80, attack: 45, defense: 40, specialAttack: 35, specialDefense: 35, speed: 56 }),
  cpuPokemon(10, "caterpie", "bug", ["bug"], { hp: 90, attack: 30, defense: 35, specialAttack: 20, specialDefense: 20, speed: 45 }),
  cpuPokemon(35, "clefairy", "fairy", ["fairy"], { hp: 110, attack: 45, defense: 48, specialAttack: 60, specialDefense: 65, speed: 35 }),
  cpuPokemon(63, "abra", "psychic", ["psychic"], { hp: 60, attack: 20, defense: 15, specialAttack: 105, specialDefense: 55, speed: 90 }),
  cpuPokemon(147, "dratini", "dragon", ["dragon"], { hp: 82, attack: 64, defense: 45, specialAttack: 50, specialDefense: 50, speed: 50 }),
  cpuPokemon(261, "poochyena", "dark", ["dark"], { hp: 70, attack: 55, defense: 35, specialAttack: 30, specialDefense: 30, speed: 35 }),
  cpuPokemon(304, "aron", "steel", ["steel", "rock"], { hp: 80, attack: 70, defense: 100, specialAttack: 40, specialDefense: 40, speed: 30 }),
  cpuPokemon(361, "snorunt", "ice", ["ice"], { hp: 100, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 }),
  // Evolved and high-stat species are local enriched metadata: CPU startup never fetches PokeAPI.
  cpuPokemon(59, "arcanine", "fire", ["fire"], { hp: 90, attack: 110, defense: 80, specialAttack: 100, specialDefense: 80, speed: 95 }, { evolutionStage: "final", cpuTier: "powerful", abilityId: "flash-fire" }),
  cpuPokemon(68, "machamp", "fighting", ["fighting"], { hp: 90, attack: 130, defense: 80, specialAttack: 65, specialDefense: 85, speed: 55 }, { evolutionStage: "final", cpuTier: "evolved" }),
  cpuPokemon(94, "gengar", "ghost", ["ghost", "poison"], { hp: 60, attack: 65, defense: 60, specialAttack: 130, specialDefense: 75, speed: 110 }, { evolutionStage: "final", cpuTier: "evolved", abilityId: "levitate" }),
  cpuPokemon(65, "alakazam", "psychic", ["psychic"], { hp: 55, attack: 50, defense: 45, specialAttack: 135, specialDefense: 95, speed: 120 }, { evolutionStage: "final", cpuTier: "evolved", abilityId: "synchronize" }),
  cpuPokemon(130, "gyarados", "water", ["water", "flying"], { hp: 95, attack: 125, defense: 79, specialAttack: 60, specialDefense: 100, speed: 81 }, { evolutionStage: "final", cpuTier: "powerful" }),
  cpuPokemon(131, "lapras", "water", ["water", "ice"], { hp: 130, attack: 85, defense: 80, specialAttack: 85, specialDefense: 95, speed: 60 }, { evolutionStage: "final", cpuTier: "powerful" }),
  cpuPokemon(143, "snorlax", "normal", ["normal"], { hp: 160, attack: 110, defense: 65, specialAttack: 65, specialDefense: 110, speed: 30 }, { evolutionStage: "final", cpuTier: "powerful" }),
  cpuPokemon(212, "scizor", "bug", ["bug", "steel"], { hp: 70, attack: 130, defense: 100, specialAttack: 55, specialDefense: 80, speed: 65 }, { evolutionStage: "final", cpuTier: "evolved" }),
  cpuPokemon(448, "lucario", "fighting", ["fighting", "steel"], { hp: 70, attack: 110, defense: 70, specialAttack: 115, specialDefense: 70, speed: 90 }, { evolutionStage: "final", cpuTier: "powerful" }),
  cpuPokemon(462, "magnezone", "electric", ["electric", "steel"], { hp: 70, attack: 70, defense: 115, specialAttack: 130, specialDefense: 90, speed: 60 }, { evolutionStage: "final", cpuTier: "powerful" }),
  cpuPokemon(466, "electivire", "electric", ["electric"], { hp: 75, attack: 123, defense: 67, specialAttack: 95, specialDefense: 85, speed: 95 }, { evolutionStage: "final", cpuTier: "powerful" }),
  cpuPokemon(149, "dragonite", "dragon", ["dragon", "flying"], { hp: 91, attack: 134, defense: 95, specialAttack: 100, specialDefense: 100, speed: 80 }, { evolutionStage: "final", cpuTier: "pseudo" }),
  cpuPokemon(248, "tyranitar", "rock", ["rock", "dark"], { hp: 100, attack: 134, defense: 110, specialAttack: 95, specialDefense: 100, speed: 61 }, { evolutionStage: "final", cpuTier: "pseudo" }),
  cpuPokemon(376, "metagross", "steel", ["steel", "psychic"], { hp: 80, attack: 135, defense: 130, specialAttack: 95, specialDefense: 90, speed: 70 }, { evolutionStage: "final", cpuTier: "pseudo" }),
  cpuPokemon(445, "garchomp", "dragon", ["dragon", "ground"], { hp: 108, attack: 130, defense: 95, specialAttack: 80, specialDefense: 85, speed: 102 }, { evolutionStage: "final", cpuTier: "pseudo" }),
  cpuPokemon(635, "hydreigon", "dark", ["dark", "dragon"], { hp: 92, attack: 105, defense: 90, specialAttack: 125, specialDefense: 90, speed: 98 }, { evolutionStage: "final", cpuTier: "pseudo" }),
  cpuPokemon(150, "mewtwo", "psychic", ["psychic"], { hp: 106, attack: 110, defense: 90, specialAttack: 154, specialDefense: 90, speed: 130 }, { evolutionStage: "legendary", cpuTier: "legendary", rarity: "legendary", isLegendary: true }),
  cpuPokemon(249, "lugia", "psychic", ["psychic", "flying"], { hp: 106, attack: 90, defense: 130, specialAttack: 90, specialDefense: 154, speed: 110 }, { evolutionStage: "legendary", cpuTier: "legendary", rarity: "legendary", isLegendary: true }),
  cpuPokemon(382, "kyogre", "water", ["water"], { hp: 100, attack: 100, defense: 90, specialAttack: 150, specialDefense: 140, speed: 90 }, { evolutionStage: "legendary", cpuTier: "legendary", rarity: "legendary", isLegendary: true }),
  cpuPokemon(384, "rayquaza", "dragon", ["dragon", "flying"], { hp: 105, attack: 150, defense: 90, specialAttack: 150, specialDefense: 90, speed: 95 }, { evolutionStage: "legendary", cpuTier: "legendary", rarity: "legendary", isLegendary: true }),
  cpuPokemon(151, "mew", "psychic", ["psychic"], { hp: 100, attack: 100, defense: 100, specialAttack: 100, specialDefense: 100, speed: 100 }, { evolutionStage: "mythical", cpuTier: "mythical", rarity: "mythical", isMythical: true }),
  cpuPokemon(491, "darkrai", "dark", ["dark"], { hp: 70, attack: 90, defense: 90, specialAttack: 135, specialDefense: 90, speed: 125 }, { evolutionStage: "mythical", cpuTier: "mythical", rarity: "mythical", isMythical: true }),
]);

export const CPU_TEAM = CPU_ROSTER.slice(0, 3);
import { calculateLeveledStat, getBaseStats, getPokemonLevel, getStatMultiplier } from "@/lib/pokemon/progression";
