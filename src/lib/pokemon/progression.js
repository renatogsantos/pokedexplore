export const MAX_POKEMON_LEVEL = 10;
export const STAT_BONUS_PER_LEVEL = 0.05;

export function getPokemonLevel(pokemon) {
  return Math.min(MAX_POKEMON_LEVEL, Math.max(1, Number(pokemon?.level) || 1));
}

export function getStatMultiplier(level = 1) {
  return 1 + (getPokemonLevel({ level }) - 1) * STAT_BONUS_PER_LEVEL;
}

export function getBaseStats(pokemon) {
  if (pokemon?.baseStats?.hp) return { hp: pokemon.baseStats.hp, attack: pokemon.baseStats.attack || 50 };
  const findStat = (name, fallback) => pokemon?.stats?.find((stat) => stat.stat?.name === name)?.base_stat || fallback;
  return { hp: findStat("hp", pokemon?.maxHp || 90), attack: findStat("attack", 50) };
}

export function calculateLeveledStat(baseStat, level = 1) {
  return Math.round(baseStat * getStatMultiplier(level));
}

export function normalizeCapturedPokemon(pokemon) {
  return { ...pokemon, level: getPokemonLevel(pokemon), baseStats: getBaseStats(pokemon) };
}
