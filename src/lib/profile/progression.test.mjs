import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyPlayerStats,
  getTotalXpForTrainerLevel,
  getTrainerProgress,
  normalizeBattleMode,
  recordCompletedBattle,
  TRAINER_XP_REWARDS,
} from "./progression.js";

test("trainer level uses deterministic cumulative thresholds", () => {
  assert.deepEqual(getTrainerProgress(0), { totalXp: 0, level: 1, currentXp: 0, nextLevelXp: 100, percent: 0 });
  assert.equal(getTrainerProgress(100).level, 2);
  assert.equal(getTrainerProgress(299).currentXp, 199);
  assert.equal(getTrainerProgress(300).level, 3);
  assert.equal(getTotalXpForTrainerLevel(1), 0);
  assert.equal(getTotalXpForTrainerLevel(2), 100);
  assert.equal(getTotalXpForTrainerLevel(3), 300);
});

test("battle modes normalize into the four profile groups", () => {
  assert.equal(normalizeBattleMode("friend"), "pvp");
  assert.equal(normalizeBattleMode("badge-pvp"), "badge");
  assert.equal(normalizeBattleMode("tournament"), "tournament");
  assert.equal(normalizeBattleMode("cpu"), "cpu");
});

test("completed battles are idempotent and only wins grant XP", () => {
  const initial = createEmptyPlayerStats();
  const first = recordCompletedBattle(initial, { matchId: "match-1", won: true, mode: "pvp" });
  assert.equal(first.recorded, true);
  assert.equal(first.earnedXp, TRAINER_XP_REWARDS.PVP_WIN);
  assert.equal(first.stats.byMode.pvp.wins, 1);
  const duplicate = recordCompletedBattle(first.stats, { matchId: "match-1", won: true, mode: "pvp" });
  assert.equal(duplicate.recorded, false);
  assert.equal(duplicate.stats.battlesCompleted, 1);
  const loss = recordCompletedBattle(first.stats, { matchId: "match-2", won: false, mode: "badge-cpu" });
  assert.equal(loss.earnedXp, 0);
  assert.equal(loss.stats.byMode.badge.losses, 1);
});

test("legacy aggregate can be preserved without inventing per-mode history", () => {
  const legacy = createEmptyPlayerStats({ legacyWins: 4, legacyBattles: 7 });
  assert.equal(legacy.wins, 4);
  assert.equal(legacy.losses, 3);
  assert.equal(legacy.byMode.cpu.battlesCompleted, 0);
  assert.equal(legacy.includesLegacyAggregate, true);
});
