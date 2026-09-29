import { ITEM_CATALOG, ITEM_RARITY, getItemDefinition } from "../items/catalog.js";
import {
  MATCH_STATUS,
  ROUND,
  TOURNAMENT_PLACEMENT,
  TOURNAMENT_STATUS,
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

export function selectTournamentRewardItem(placement, random = Math.random) {
  const choice = weightedPick(REWARD_POOLS[placement] || [], random);
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
  const item = selectTournamentRewardItem(placement, random);
  if (!item) return null;
  return {
    id: getTournamentRewardId(tournament.id, playerId, placement),
    tournamentId: tournament.id,
    playerId,
    placement,
    coins: tier.coins,
    itemId: item.id,
    rarity: item.rarity,
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
