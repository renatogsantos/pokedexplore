import { createClient } from "@supabase/supabase-js";
import { getBadgeConfig } from "./config";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
let sharedClient;

const client = () => {
  if (!url || !key) throw new Error("O serviço de Insígnias não está configurado.");
  sharedClient ||= createClient(url, key, { auth: { persistSession: false } });
  return sharedClient;
};

const fail = (message) => { throw new Error(message); };
const displayName = (value) => String(value || "Treinador").trim().slice(0, 18) || "Treinador";

function friendlyError(error, fallback = "Não foi possível atualizar as Insígnias agora.") {
  const messages = {
    PB001: "Esta Insígnia não está mais disponível.",
    PB002: "Esta Insígnia já está em disputa.",
    PB003: "Você já é o campeão desta Insígnia.",
    PB004: "Este desafio não está mais ativo.",
    PB005: "O campeão mudou. Atualize a Insígnia antes de desafiar novamente.",
    PB006: "O resultado desta batalha não é válido para o desafio.",
  };
  return new Error(messages[error?.code] || fallback);
}

export function hasBadgeServiceConfig() {
  return Boolean(url && key);
}

export async function registerCompetitivePlayer(profile) {
  if (!profile?.playerId) return null;
  const db = client();
  const { data, error } = await db.rpc("register_competitive_player", {
    p_player_id: profile.playerId,
    p_display_name: displayName(profile.displayName),
  });
  if (error) throw friendlyError(error);
  return data;
}

export async function releaseExpiredBadgeState() {
  const db = client();
  const { error } = await db.rpc("release_expired_badge_state");
  if (error) throw friendlyError(error);
}

export async function listBadges() {
  const db = client();
  await releaseExpiredBadgeState();
  const [{ data: badges, error: badgeError }, { data: challenges, error: challengeError }] = await Promise.all([
    db.from("badges").select("*, owner:competitive_players!badges_owner_player_id_fkey(last_battle_at)").order("sort_order"),
    db.from("badge_challenges").select("*").in("status", ["PENDING_ACCEPTANCE", "ACTIVE"]),
  ]);
  if (badgeError || challengeError) throw friendlyError(badgeError || challengeError, "Não foi possível carregar as Insígnias.");
  const activeByBadge = new Map((challenges || []).map((challenge) => [challenge.badge_id, challenge]));
  return (badges || []).map((badge) => ({
    ...badge,
    config: getBadgeConfig(badge.code),
    activeChallenge: activeByBadge.get(badge.id) || null,
    ownerLastBattleAt: badge.owner?.last_battle_at || null,
  }));
}

export async function getBadge(code) {
  const badges = await listBadges();
  return badges.find((badge) => badge.code === String(code || "").toLowerCase()) || null;
}

export async function getBadgeHistory(badgeId) {
  const db = client();
  const { data, error } = await db.from("badge_history").select("*").eq("badge_id", badgeId).order("created_at", { ascending: false }).limit(30);
  if (error) throw friendlyError(error, "Não foi possível carregar o histórico.");
  return data || [];
}

export async function startBadgeChallenge(badgeCode, profile) {
  if (!profile?.playerId) return fail("Seu perfil local ainda está carregando.");
  const db = client();
  await registerCompetitivePlayer(profile);
  const { data, error } = await db.rpc("start_badge_challenge", {
    p_badge_code: String(badgeCode || "").toLowerCase(),
    p_challenger_player_id: profile.playerId,
    p_challenger_name: displayName(profile.displayName),
  });
  if (error) throw friendlyError(error);
  return data;
}

export async function getBadgeChallenge(challengeId) {
  const db = client();
  await releaseExpiredBadgeState();
  const { data, error } = await db
    .from("badge_challenges")
    .select("*, badge:badges(*)")
    .eq("id", challengeId)
    .maybeSingle();
  if (error) throw friendlyError(error, "Não foi possível carregar o Desafio da Insígnia.");
  return data ? { ...data, badge: { ...data.badge, config: getBadgeConfig(data.badge?.code) } } : null;
}

export async function recordBadgeBattleResult({ challengeId, battleId, winnerPlayerId }) {
  const db = client();
  const { data, error } = await db.rpc("record_badge_battle_result", {
    p_challenge_id: challengeId,
    p_battle_id: battleId,
    p_winner_player_id: winnerPlayerId,
  });
  if (error) throw friendlyError(error, "Não foi possível confirmar o resultado da batalha.");
  return data;
}

export async function recordCompetitiveBattleActivity({ battleId, playerId, displayName: name, battleMode }) {
  if (!battleId || !playerId) return false;
  const db = client();
  const { data, error } = await db.rpc("record_competitive_battle_activity", {
    p_battle_id: battleId,
    p_player_id: playerId,
    p_display_name: displayName(name),
    p_battle_mode: String(battleMode || "CPU").toUpperCase(),
  });
  if (error) throw friendlyError(error);
  return Boolean(data);
}

export async function getCompetitiveStatus(playerId) {
  if (!playerId) return { badgeCount: 0, isChampion: false };
  const db = client();
  await releaseExpiredBadgeState();
  const { count, error } = await db.from("badges").select("id", { count: "exact", head: true }).eq("owner_player_id", playerId);
  if (error) throw friendlyError(error);
  return { badgeCount: count || 0, isChampion: (count || 0) > 0 };
}

export function subscribeBadges(onChange) {
  const db = client();
  const channel = db.channel("competitive-badges")
    .on("postgres_changes", { event: "*", schema: "public", table: "badges" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "badge_challenges" }, onChange)
    .subscribe();
  return () => { void db.removeChannel(channel); };
}

export function subscribeBadgeChallenge(challengeId, onChange) {
  const db = client();
  const channel = db.channel(`badge-challenge:${challengeId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "badge_challenges", filter: `id=eq.${challengeId}` }, onChange)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "badges" }, onChange)
    .subscribe();
  return () => { void db.removeChannel(channel); };
}

