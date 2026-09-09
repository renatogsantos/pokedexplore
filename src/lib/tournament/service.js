import { createClient } from "@supabase/supabase-js";
import { MATCH_STATUS, ROUND, TOURNAMENT_CONFIG, TOURNAMENT_STATUS } from "./config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isDevelopment = process.env.NODE_ENV !== "production";
const debugTournament = (event, detail) => { if (isDevelopment) console.info(`[Tournament] ${event}`, detail); };
const client = () => {
  if (!url || !key) throw new Error("Configure as variáveis do Supabase para usar Campeonatos.");
  return createClient(url, key, { auth: { persistSession: false } });
};
const normalizeCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^PKC/, "").slice(0, 4);
export const formatTournamentCode = (value) => `${TOURNAMENT_CONFIG.codePrefix}-${normalizeCode(value)}`;
const code = () => `${TOURNAMENT_CONFIG.codePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
const error = (message) => { throw new Error(message); };

export async function createTournament(profile) {
  const db = client();
  for (let tries = 0; tries < 4; tries += 1) {
    const tournamentCode = code();
    const { data: tournament, error: createError } = await db.from("tournaments").insert({ code: tournamentCode, created_by_player_id: profile.playerId }).select().single();
    if (createError?.code === "23505") continue;
    if (createError) throw createError;
    const { error: playerError } = await db.from("tournament_players").insert({ tournament_id: tournament.id, player_id: profile.playerId, display_name: profile.displayName, slot: 1 });
    if (playerError) throw playerError;
    return getTournament(tournament.id);
  }
  return error("Não foi possível gerar um código único. Tente novamente.");
}

export async function joinTournament(rawCode, profile) {
  const db = client(); const tournamentCode = formatTournamentCode(rawCode);
  const timestamp = new Date().toISOString();
  const { data: tournament, error: lookupError } = await db.from("tournaments").select("*").eq("code", tournamentCode).maybeSingle();
  if (lookupError) throw lookupError;
  if (!tournament) return error("Campeonato não encontrado.");
  if (tournament.status !== TOURNAMENT_STATUS.LOBBY) return error("Este campeonato já foi iniciado ou finalizado.");
  const { data: players, error: playersError } = await db.from("tournament_players").select("player_id,display_name,slot").eq("tournament_id", tournament.id).order("slot");
  if (playersError) throw playersError;
  debugTournament("JOIN ATTEMPT", { tournamentId: tournament.id, tournamentCode, localPlayerId: profile.playerId, displayName: profile.displayName, currentParticipantCount: players.length, currentParticipantIds: players.map((item) => item.player_id), requestedSlot: "database-assigned", clientTimestamp: timestamp });
  debugTournament("VALIDATION RESULT", { alreadyJoined: players.some((item) => item.player_id === profile.playerId), isFull: players.length >= TOURNAMENT_CONFIG.playerCount, tournamentStatus: tournament.status, allowed: tournament.status === TOURNAMENT_STATUS.LOBBY && !players.some((item) => item.player_id === profile.playerId) && players.length < TOURNAMENT_CONFIG.playerCount });
  debugTournament("DATABASE REQUEST START", { operation: "join_tournament", tournamentId: tournament.id });
  const { data: result, error: joinError } = await db.rpc("join_tournament", { p_tournament_id: tournament.id, p_player_id: profile.playerId, p_display_name: profile.displayName });
  if (joinError) {
    debugTournament("DATABASE RESULT", { success: false, code: joinError.code, message: joinError.message, details: joinError.details, hint: joinError.hint });
    if (joinError.code === "PT002") return error("Este campeonato já está completo.");
    if (joinError.code === "PT003") return error("Este campeonato já foi iniciado, cancelado ou finalizado.");
    throw joinError;
  }
  debugTournament("DATABASE RESULT", { success: true, returnedRow: result });
  if (result?.alreadyJoined) {
    const matched = players.find((item) => item.player_id === profile.playerId);
    debugTournament("JOIN REJECTED — ALREADY PARTICIPANT", { localPlayerId: profile.playerId, localDisplayName: profile.displayName, matchedDatabasePlayerId: matched?.player_id || null, matchedDisplayName: matched?.display_name || null, tournamentId: tournament.id });
  }
  const refreshed = await getTournament(tournament.id);
  debugTournament("POST-JOIN FETCH", { participantCount: refreshed?.tournament_players.length || 0, participantIds: refreshed?.tournament_players.map((item) => item.player_id) || [], slots: refreshed?.tournament_players.map((item) => item.slot) || [] });
  return { ...refreshed, joinOutcome: result };
}

export function subscribeTournament(tournamentId, onChange) {
  const db = client();
  const channel = db.channel(`tournament:${tournamentId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_players", filter: `tournament_id=eq.${tournamentId}` }, (payload) => { debugTournament("REALTIME EVENT", { eventType: payload.eventType, playerId: payload.new?.player_id || payload.old?.player_id, slot: payload.new?.slot || payload.old?.slot, tournamentId }); onChange(payload); })
    .on("postgres_changes", { event: "*", schema: "public", table: "tournament_matches", filter: `tournament_id=eq.${tournamentId}` }, (payload) => { debugTournament("REALTIME EVENT", { eventType: payload.eventType, matchId: payload.new?.id || payload.old?.id, tournamentId }); onChange(payload); })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, (payload) => { debugTournament("REALTIME EVENT", { eventType: payload.eventType, tournamentId }); onChange(payload); })
    .subscribe();
  return () => { void db.removeChannel(channel); };
}

export async function getTournament(idOrCode) {
  const db = client();
  const query = db.from("tournaments").select("*, tournament_players(*), tournament_matches(*)");
  const { data, error: readError } = String(idOrCode).startsWith("PKC-") ? await query.eq("code", idOrCode).maybeSingle() : await query.eq("id", idOrCode).maybeSingle();
  if (readError) throw readError;
  if (!data) return null;
  return { ...data, tournament_players: [...(data.tournament_players || [])].sort((a, b) => a.slot - b.slot), tournament_matches: [...(data.tournament_matches || [])].sort((a, b) => a.round_index - b.round_index) };
}

export async function getPlayerActiveTournament(playerId) {
  const db = client();
  const { data, error: readError } = await db.from("tournament_players").select("tournament_id, tournaments!inner(*)").eq("player_id", playerId).in("tournaments.status", [TOURNAMENT_STATUS.LOBBY, TOURNAMENT_STATUS.SEMIFINALS, TOURNAMENT_STATUS.FINAL]).order("joined_at", { ascending: false }).limit(1).maybeSingle();
  if (readError) throw readError;
  return data?.tournament_id ? getTournament(data.tournament_id) : null;
}

export async function startTournament(tournamentId, organizerId) {
  const db = client(); const current = await getTournament(tournamentId);
  if (!current) return error("Campeonato não encontrado.");
  if (current.created_by_player_id !== organizerId) return error("Apenas quem criou pode iniciar o campeonato.");
  if (current.status !== TOURNAMENT_STATUS.LOBBY || current.tournament_players.length !== TOURNAMENT_CONFIG.playerCount) return error("São necessários 4 jogadores para iniciar.");
  const { error: startError } = await db.rpc("start_tournament", { p_tournament_id: tournamentId, p_organizer_id: organizerId });
  if (startError) throw startError;
  return getTournament(tournamentId);
}

export async function cancelTournament(tournamentId, organizerId) {
  const db = client();
  const current = await getTournament(tournamentId);
  if (!current) return error("Campeonato não encontrado.");
  if (current.created_by_player_id !== organizerId) return error("Apenas quem criou pode cancelar o campeonato.");
  if (![TOURNAMENT_STATUS.LOBBY, TOURNAMENT_STATUS.SEMIFINALS, TOURNAMENT_STATUS.FINAL].includes(current.status)) return error("Este campeonato não pode mais ser cancelado.");
  const { error: cancelError } = await db.rpc("cancel_tournament", { p_tournament_id: tournamentId, p_organizer_id: organizerId });
  if (cancelError) throw cancelError;
  return getTournament(tournamentId);
}

export async function leaveTournament(tournamentId, playerId) {
  const db = client();
  const { error: leaveError } = await db.rpc("leave_tournament", { p_tournament_id: tournamentId, p_player_id: playerId });
  if (leaveError) throw leaveError;
}

export async function markTournamentMatchPlaying(matchId) {
  const db = client();
  const { error: markError } = await db.rpc("mark_tournament_match_playing", { p_match_id: matchId });
  if (markError) throw markError;
}

export async function completeTournamentMatch(matchId, winnerId) {
  const db = client();
  const { data: match, error: readError } = await db.from("tournament_matches").select("*").eq("id", matchId).single();
  if (readError) throw readError;
  const { data: tournament, error: tournamentError } = await db.from("tournaments").select("status").eq("id", match.tournament_id).single();
  if (tournamentError) throw tournamentError;
  if (tournament.status === TOURNAMENT_STATUS.CANCELLED) return error("Este campeonato foi cancelado pelo organizador.");
  if (match.status === MATCH_STATUS.FINISHED) return getTournament(match.tournament_id);
  if (![match.player1_id, match.player2_id].includes(winnerId)) return error("Resultado inválido para esta partida.");
  if (match.round === ROUND.FINAL) {
    const { error: finishError } = await db.rpc("finish_tournament_final", { p_match_id: matchId, p_winner_id: winnerId });
    if (finishError) throw finishError;
    return getTournament(match.tournament_id);
  }
  const { data: updated, error: updateError } = await db.from("tournament_matches").update({ winner_id: winnerId, status: MATCH_STATUS.FINISHED, finished_at: new Date().toISOString() }).eq("id", matchId).neq("status", MATCH_STATUS.FINISHED).select().maybeSingle();
  if (updateError) throw updateError;
  if (!updated) return getTournament(match.tournament_id);
  const loserId = match.player1_id === winnerId ? match.player2_id : match.player1_id;
  await Promise.all([
    db.from("tournament_players").update({ status: match.round === ROUND.FINAL ? "CHAMPION" : "QUALIFIED" }).eq("tournament_id", match.tournament_id).eq("player_id", winnerId),
    db.from("tournament_players").update({ status: "ELIMINATED" }).eq("tournament_id", match.tournament_id).eq("player_id", loserId),
  ]);
  const { data: semis } = await db.from("tournament_matches").select("*").eq("tournament_id", match.tournament_id).eq("round", ROUND.SEMIFINAL).eq("status", MATCH_STATUS.FINISHED);
  if (semis?.length === 2) {
    const { error: finalError } = await db.from("tournament_matches").insert({ tournament_id: match.tournament_id, round: ROUND.FINAL, round_index: 1, player1_id: semis[0].winner_id, player2_id: semis[1].winner_id, status: MATCH_STATUS.WAITING, battle_room_code: `PKT-${match.tournament_id.slice(0, 8)}-F` });
    if (finalError && finalError.code !== "23505") throw finalError;
    await db.from("tournaments").update({ status: TOURNAMENT_STATUS.FINAL }).eq("id", match.tournament_id).eq("status", TOURNAMENT_STATUS.SEMIFINALS);
  }
  return getTournament(match.tournament_id);
}
