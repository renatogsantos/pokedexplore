import { BADGE_CHAMPION_COIN_MULTIPLIER } from "@/lib/badges/config";

export const BASE_VICTORY_COINS = 15;
export const COINS_PER_WIN = BASE_VICTORY_COINS;
export const FAST_VICTORY_BONUS_COINS = 15;
export const FAST_VICTORY_THRESHOLD_MS = 60_000;
export const ONE_POKEMON_VICTORY_BONUS_COINS = 30;

export function calculateBattleRewards({ won, durationMs, usedOnlyOnePokemon, championBonusEligible = false }) {
  if (!won) return { base: 0, bonuses: { fastVictory: 0, onePokemonVictory: 0, champion: 0 }, total: 0 };
  const fastVictory = Number.isFinite(durationMs) && durationMs < FAST_VICTORY_THRESHOLD_MS;
  const onePokemonVictory = Boolean(usedOnlyOnePokemon);
  const existingBonuses = { fastVictory: fastVictory ? FAST_VICTORY_BONUS_COINS : 0, onePokemonVictory: onePokemonVictory ? ONE_POKEMON_VICTORY_BONUS_COINS : 0 };
  const subtotal = BASE_VICTORY_COINS + existingBonuses.fastVictory + existingBonuses.onePokemonVictory;
  const champion = championBonusEligible ? Math.round(subtotal * (BADGE_CHAMPION_COIN_MULTIPLIER - 1)) : 0;
  return { base: BASE_VICTORY_COINS, bonuses: { ...existingBonuses, champion }, total: subtotal + champion };
}
