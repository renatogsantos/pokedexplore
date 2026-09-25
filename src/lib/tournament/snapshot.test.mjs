import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTournamentSnapshot } from "./snapshot.js";

test("normalizes incomplete tournament relation snapshots for rendering", () => {
  assert.equal(normalizeTournamentSnapshot(null), null);
  assert.deepEqual(normalizeTournamentSnapshot({ id: "t-1" }), {
    id: "t-1",
    tournament_players: [],
    tournament_matches: [],
  });
});

test("removes null relation rows and preserves deterministic bracket order", () => {
  const snapshot = normalizeTournamentSnapshot({
    tournament_players: [null, { player_id: "p2", slot: 2 }, { player_id: "p1", slot: 1 }],
    tournament_matches: [null, { id: "final", round_index: 2 }, { id: "semi", round_index: 1 }],
  });

  assert.deepEqual(snapshot.tournament_players.map(({ player_id }) => player_id), ["p1", "p2"]);
  assert.deepEqual(snapshot.tournament_matches.map(({ id }) => id), ["semi", "final"]);
});
