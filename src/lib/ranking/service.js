import { createClient } from "@supabase/supabase-js";
import { validateCompetitiveEvent } from "./results";

let shared;
export function hasRankingConfig() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }
function db() {
  if (!hasRankingConfig()) throw new Error("Ranking indisponível neste ambiente.");
  return shared ||= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}
async function rpc(name, args) {
  const { data, error } = await db().rpc(name, args);
  if (error) throw error;
  return data;
}
export function syncRankingProfile(profile) {
  return rpc("sync_trainer_ranking_profile", { p_player_id: profile.playerId, p_display_name: profile.displayName, p_avatar_id: profile.avatarId });
}
export function submitCompetitiveResult(event) {
  if (!validateCompetitiveEvent(event)) throw new Error("Resultado competitivo inválido.");
  return rpc("submit_competitive_result", {
    p_match_id: event.matchId, p_player_id: event.playerId, p_mode: event.mode, p_result: event.result,
    p_opponent_player_id: event.opponentPlayerId, p_completed_at: event.completedAt,
  });
}
export function getTrainerRanking(playerId, offset = 3, limit = 20) {
  return rpc("get_trainer_ranking", { p_player_id: playerId || null, p_offset: offset, p_limit: limit });
}
export function getPublicTrainer(playerId) { return rpc("get_public_trainer", { p_player_id: playerId }); }
