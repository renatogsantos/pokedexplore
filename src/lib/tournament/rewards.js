import { ITEM_CATALOG, ITEM_RARITY, getItemDefinition } from "../items/catalog.js";
import {
  MATCH_STATUS,
  ROUND,
  TOURNAMENT_PLACEMENT,
  TOURNAMENT_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_REWARD_MULTIPLIER,
  getTournamentRewardTier,
} from "./config.js";

const REWARD_POOLS = Object.freeze({
  [TOURNAMENT_PLACEMENT.SEMIFINALIST]: Object.freeze([
    Object.freeze({ rarity: ITEM_RARITY.COMMON, weight: 65 }),
    Object.freeze({ rarity: ITEM_RARITY.RARE, weight: 35 }),
  ]),
  [TOURNAMENT_PLACEMENT.FINALIST]: Object.freeze([
    Object.freeze({ rarity: ITEM_RARITY.RARE, weight: 75 }),
    Object.freeze({ rarity: ITEM_RARITY.EPIC, weight: 25 }),
  ]),
  [TOURNAMENT_PLACEMENT.CHAMPION]: Object.freeze([
    Object.freeze({ rarity: ITEM_RARITY.EPIC, weight: 92 }),
    Object.freeze({ rarity: ITEM_RARITY.LEGENDARY, weight: 8 }),
  ]),
});
const HYBRID_REWARD_POOLS = Object.freeze({
  [TOURNAMENT_PLACEMENT.SEMIFINALIST]: Object.freeze([{ rarity: ITEM_RARITY.COMMON, weight: 85 }, { rarity: ITEM_RARITY.RARE, weight: 15 }]),
  [TOURNAMENT_PLACEMENT.FINALIST]: Object.freeze([{ rarity: ITEM_RARITY.RARE, weight: 90 }, { rarity: ITEM_RARITY.EPIC, weight: 10 }]),
  [TOURNAMENT_PLACEMENT.CHAMPION]: Object.freeze([{ rarity: ITEM_RARITY.RARE, weight: 65 }, { rarity: ITEM_RARITY.EPIC, weight: 35 }]),
});

const isFinishedResult = (match) =>
  match?.status === MATCH_STATUS.FINISHED &&
  Boolean(match.winner_id) &&
  [match.player1_id, match.player2_id].includes(match.winner_id);

export function getTournamentPlacement(tournament, playerId) {
  if (!tournament?.id || !playerId || tournament.status === TOURNAMENT_STATUS.CANCELLED)
    return null;
  const matches = Array.isArray(tournament.tournament_matches)
    ? tournament.tournament_matches
    : [];
  const final = matches.find((match) => match.round === ROUND.FINAL);
  if (isFinishedResult(final) && [final.player1_id, final.player2_id].includes(playerId)) {
    return final.winner_id === playerId
      ? TOURNAMENT_PLACEMENT.CHAMPION
      : TOURNAMENT_PLACEMENT.FINALIST;
  }
  const lostSemifinal = matches.some(
    (match) =>
      match.round === ROUND.SEMIFINAL &&
      isFinishedResult(match) &&
      [match.player1_id, match.player2_id].includes(playerId) &&
      match.winner_id !== playerId,
  );
  return lostSemifinal ? TOURNAMENT_PLACEMENT.SEMIFINALIST : null;
}

export function getTournamentRewardId(tournamentId, playerId, placement) {
  return `tournament:${tournamentId}:player:${playerId}:${String(placement).toLowerCase()}`;
}

function weightedPick(entries, random) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = random() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor < 0) return entry;
  }
  return entries.at(-1);
}

export function selectTournamentRewardItem(placement, random = Math.random, mode = TOURNAMENT_MODE.NORMAL) {
  const choice = weightedPick((mode === TOURNAMENT_MODE.HYBRID ? HYBRID_REWARD_POOLS : REWARD_POOLS)[placement] || [], random);
  if (!choice) return null;
  const pool = ITEM_CATALOG.filter(
    (item) => item.purchasable !== false && item.rarity === choice.rarity && getItemDefinition(item.id),
  );
  return pool.length ? pool[Math.floor(random() * pool.length)] : null;
}

export function resolveTournamentReward(tournament, playerId, random = Math.random) {
  const placement = getTournamentPlacement(tournament, playerId);
  const tier = getTournamentRewardTier(placement);
  if (!tier) return null;
  const mode = tournament.mode === TOURNAMENT_MODE.HYBRID ? TOURNAMENT_MODE.HYBRID : TOURNAMENT_MODE.NORMAL;
  const multiplier = mode === TOURNAMENT_MODE.HYBRID ? TOURNAMENT_REWARD_MULTIPLIER.HYBRID : TOURNAMENT_REWARD_MULTIPLIER.NORMAL;
  const item = selectTournamentRewardItem(placement, random, mode);
  if (!item) return null;
  return {
    id: getTournamentRewardId(tournament.id, playerId, placement),
    tournamentId: tournament.id,
    playerId,
    placement,
    coins: Math.round(tier.coins * multiplier),
    itemId: item.id,
    rarity: item.rarity,
    multiplier,
  };
}

export function applyTournamentRewardReceipt(economy, reward, claimedAt = Date.now()) {
  if (!reward?.id || !reward?.itemId || !getItemDefinition(reward.itemId))
    return { applied: false, economy, receipt: null };
  const receipts = Array.isArray(economy?.tournamentRewardReceipts)
    ? economy.tournamentRewardReceipts
    : [];
  const existing = receipts.find((receipt) => receipt.id === reward.id);
  if (existing) return { applied: false, economy, receipt: existing };
  const receipt = { ...reward, claimedAt };
  const inventory = {
    ...(economy?.inventory || {}),
    [reward.itemId]: Number(economy?.inventory?.[reward.itemId] || 0) + 1,
  };
  return {
    applied: true,
    receipt,
    economy: {
      ...economy,
      coins: Number(economy?.coins || 0) + Number(reward.coins || 0),
      inventory,
      tournamentRewardReceipts: [...receipts, receipt].slice(-240),
    },
  };
}
