export const BASE_VICTORY_COINS = 15;
export const COINS_PER_WIN = BASE_VICTORY_COINS;
export const FAST_VICTORY_BONUS_COINS = 15;
export const FAST_VICTORY_THRESHOLD_MS = 60_000;
export const ONE_POKEMON_VICTORY_BONUS_COINS = 30;

export function calculateBattleRewards({ won, durationMs, usedOnlyOnePokemon }) {
  if (!won) return { base: 0, bonuses: { fastVictory: 0, onePokemonVictory: 0 }, total: 0 };
  const fastVictory = Number.isFinite(durationMs) && durationMs < FAST_VICTORY_THRESHOLD_MS;
  const onePokemonVictory = Boolean(usedOnlyOnePokemon);
  const bonuses = { fastVictory: fastVictory ? FAST_VICTORY_BONUS_COINS : 0, onePokemonVictory: onePokemonVictory ? ONE_POKEMON_VICTORY_BONUS_COINS : 0 };
  return { base: BASE_VICTORY_COINS, bonuses, total: BASE_VICTORY_COINS + bonuses.fastVictory + bonuses.onePokemonVictory };
}
