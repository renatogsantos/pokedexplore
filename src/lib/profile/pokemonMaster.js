import { BADGE_CONFIG } from "@/lib/badges/config";

export const POKEMON_MASTER_TITLE = "MESTRE POKÉMON";
export const POKEMON_MASTER_BONUS_COINS = 1500;

// Input must come from current shared badge ownership, never a local count.
// This selector does not validate battle results or authorize coin settlement.
export function hasPokemonMasterTitle(playerId, badges = []) {
  if (!playerId || !Array.isArray(badges)) return false;
  const owned = new Set(badges
    .filter((badge) => badge?.owner_player_id === playerId)
    .map((badge) => badge.code));
  return BADGE_CONFIG.length > 0 && BADGE_CONFIG.every((badge) => owned.has(badge.code));
}
