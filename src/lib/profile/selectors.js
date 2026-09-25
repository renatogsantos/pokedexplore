import { BADGE_CONFIG } from "@/lib/badges/config";
import { getPokemonLevel, MAX_POKEMON_LEVEL } from "@/lib/pokemon/progression";
import { getPokemonRarity, POKEMON_RARITY } from "@/lib/pokemon/rarity";
import { getTrainerProgress, normalizePlayerStats } from "./progression";

export function shortenTrainerId(playerId) {
  const compact = String(playerId || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  const visible = compact.slice(-8).padStart(8, "0");
  return `${visible.slice(0, 4)}-${visible.slice(4)}`;
}

export function selectCollectionStats(collection = []) {
  const normalized = Array.isArray(collection) ? collection : [];
  return normalized.reduce((stats, pokemon) => {
    const level = getPokemonLevel(pokemon);
    const rarity = getPokemonRarity(pokemon);
    stats.total += 1;
    if (rarity === POKEMON_RARITY.LEGENDARY) stats.legendary += 1;
    if (rarity === POKEMON_RARITY.MYTHICAL) stats.mythical += 1;
    if (level === MAX_POKEMON_LEVEL) stats.maxLevel += 1;
    if (level > stats.highestLevel) {
      stats.highestLevel = level;
      stats.highestLevelPokemon = [pokemon];
    } else if (level === stats.highestLevel && stats.highestLevelPokemon.length < 3) stats.highestLevelPokemon.push(pokemon);
    return stats;
  }, { total: 0, legendary: 0, mythical: 0, maxLevel: 0, highestLevel: 0, highestLevelPokemon: [] });
}

export function selectBadgeProfile(remote, playerId) {
  const badgesByCode = new Map((remote?.badges || []).map((badge) => [badge.code, badge]));
  const conqueredBadgeIds = new Set((remote?.history || [])
    .filter((event) => ["INITIAL_CLAIM", "TRANSFER"].includes(event.event_type) && event.new_owner_player_id === playerId)
    .map((event) => event.badge_id));
  const slots = BADGE_CONFIG.map((config) => {
    const badge = badgesByCode.get(config.code) || null;
    const current = badge?.owner_player_id === playerId;
    const conquered = current || (badge && conqueredBadgeIds.has(badge.id));
    return { config, badge, current, conquered, state: current ? "current" : conquered ? "conquered" : "locked" };
  });
  const currentBadges = slots.filter((slot) => slot.current);
  const conqueredBadges = slots.filter((slot) => slot.conquered);
  return {
    slots,
    currentBadges,
    conqueredBadges,
    currentCount: currentBadges.length,
    conqueredCount: conqueredBadges.length,
    remainingCount: BADGE_CONFIG.length - conqueredBadges.length,
    currentDefenseCount: currentBadges.reduce((total, slot) => total + (Number(slot.badge?.defense_count) || 0), 0),
    lifetimeDefenseCount: (remote?.history || []).filter((event) => event.event_type === "DEFENSE" && event.new_owner_player_id === playerId).length,
    activeChallenge: remote?.activeChallenge || null,
    lastBattleAt: remote?.player?.last_battle_at || null,
  };
}

export function selectLocalTrainerProfile({ identity, collection, economy, decks }) {
  const progress = economy?.progress || {};
  const playerStats = normalizePlayerStats(progress.playerStats, { legacyWins: progress.wins, legacyBattles: progress.totalBattles });
  return {
    identity,
    trainerId: shortenTrainerId(identity?.playerId),
    coins: Math.max(0, Number(economy?.coins) || 0),
    decks: Array.isArray(decks) ? decks : [],
    collection: selectCollectionStats(collection),
    battles: {
      ...playerStats,
      winRate: playerStats.battlesCompleted ? Math.round((playerStats.wins / playerStats.battlesCompleted) * 100) : 0,
    },
    progression: getTrainerProgress(progress.trainerXp),
  };
}
