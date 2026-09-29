import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTournamentRewardReceipt,
  getTournamentRewardPreview,
  getTournamentPlacement,
  resolveTournamentReward,
} from "./rewards.js";
import { TOURNAMENT_CONFIG, TOURNAMENT_REWARD_MULTIPLIER } from "./config.js";

const players = ["a", "b", "c", "d"].map((player_id, index) => ({ player_id, slot: index + 1 }));
const semifinalSnapshot = {
  id: "t-1",
  status: "FINAL",
  tournament_players: players,
  tournament_matches: [
    { id: "s1", round: "SEMIFINAL", round_index: 1, player1_id: "a", player2_id: "b", winner_id: "a", status: "FINISHED" },
    { id: "s2", round: "SEMIFINAL", round_index: 2, player1_id: "c", player2_id: "d", winner_id: "c", status: "FINISHED" },
  ],
};
const finishedSnapshot = {
  ...semifinalSnapshot,
  status: "FINISHED",
  tournament_matches: [
    ...semifinalSnapshot.tournament_matches,
    { id: "f", round: "FINAL", round_index: 3, player1_id: "a", player2_id: "c", winner_id: "a", status: "FINISHED" },
  ],
};

test("tournament placements require an authoritative finished match", () => {
  assert.equal(getTournamentPlacement(semifinalSnapshot, "b"), "SEMIFINALIST");
  assert.equal(getTournamentPlacement(semifinalSnapshot, "a"), null);
  assert.equal(getTournamentPlacement(finishedSnapshot, "a"), "CHAMPION");
  assert.equal(getTournamentPlacement(finishedSnapshot, "c"), "FINALIST");
  assert.equal(getTournamentPlacement({ ...finishedSnapshot, status: "CANCELLED" }, "a"), null);
  assert.equal(getTournamentPlacement(finishedSnapshot, "not-a-player"), null);
});

test("reward tiers respect placement and champion legendary access is controlled", () => {
  const semifinal = resolveTournamentReward(semifinalSnapshot, "b", () => 0.99);
  const finalist = resolveTournamentReward(finishedSnapshot, "c", () => 0.99);
  const championEpic = resolveTournamentReward(finishedSnapshot, "a", () => 0.5);
  const championLegendary = resolveTournamentReward(finishedSnapshot, "a", () => 0.99);
  assert.equal(semifinal.placement, "SEMIFINALIST");
  assert.equal(finalist.placement, "FINALIST");
  assert.equal(championEpic.placement, "CHAMPION");
  assert.equal(championEpic.rarity, "EPIC");
  assert.equal(championLegendary.rarity, "LEGENDARY");
  assert.ok(championEpic.coins > finalist.coins && finalist.coins > semifinal.coins);
});

test("hybrid tournaments apply the canonical half multiplier and reduced item pool", () => {
  const hybrid = { ...finishedSnapshot, mode: "HYBRID", reward_multiplier: 0.5 };
  const normal = resolveTournamentReward(finishedSnapshot, "a", () => 0.99);
  const reward = resolveTournamentReward(hybrid, "a", () => 0.99);
  assert.equal(reward.coins, normal.coins / 2);
  assert.equal(reward.multiplier, 0.5);
  assert.notEqual(reward.rarity, "LEGENDARY");
});

test("hybrid reward preview is derived from the same coins and rarity pool", () => {
  const preview = getTournamentRewardPreview("HYBRID");
  assert.equal(preview.champion.coins, TOURNAMENT_CONFIG.rewards.champion.coins * TOURNAMENT_REWARD_MULTIPLIER.HYBRID);
  assert.equal(preview.champion.rarityLabel, "RARE ou EPIC");
  assert.equal(preview.finalist.rarityLabel, "RARE ou EPIC");
});

test("tournament receipt increments inventory once and is safe to reconcile repeatedly", () => {
  const reward = resolveTournamentReward(finishedSnapshot, "a", () => 0.5);
  const initial = { coins: 10, inventory: { [reward.itemId]: 2 }, tournamentRewardReceipts: [] };
  const first = applyTournamentRewardReceipt(initial, reward, 100);
  const second = applyTournamentRewardReceipt(first.economy, reward, 101);
  assert.equal(first.applied, true);
  assert.equal(first.economy.coins, 10 + reward.coins);
  assert.equal(first.economy.inventory[reward.itemId], 3);
  assert.equal(second.applied, false);
  assert.equal(second.economy.coins, first.economy.coins);
  assert.equal(second.economy.inventory[reward.itemId], 3);
});
