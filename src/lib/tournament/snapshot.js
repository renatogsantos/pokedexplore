const byNumericField = (field) => (left, right) =>
  (left?.[field] || 0) - (right?.[field] || 0);

/**
 * Keeps a tournament renderable while a fetch/realtime refresh is incomplete.
 * Supabase relation fields are not guaranteed to be present on every transient
 * snapshot, but the UI contract is always an array for both relations.
 */
export function normalizeTournamentSnapshot(data) {
  if (!data) return null;

  return {
    ...data,
    tournament_players: Array.isArray(data.tournament_players)
      ? [...data.tournament_players].filter(Boolean).sort(byNumericField("slot"))
      : [],
    tournament_matches: Array.isArray(data.tournament_matches)
      ? [...data.tournament_matches]
          .filter(Boolean)
          .sort(byNumericField("round_index"))
      : [],
  };
}
