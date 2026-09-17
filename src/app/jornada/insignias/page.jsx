"use client";

import {
  ArrowLeft,
  Check,
  ClockCountdown,
  Coins,
  Crown,
  ShieldCheck,
  Sword,
  Trophy,
  Warning,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BadgeArtwork from "@/components/Badges/BadgeArtwork";
import { BADGE_CONFIG, BADGE_INACTIVITY_HOURS, BADGE_REQUIRED_WINS } from "@/lib/badges/config";
import {
  getBadgeHistory,
  listBadges,
  registerCompetitivePlayer,
  startBadgeChallenge,
  subscribeBadges,
} from "@/lib/badges/service";
import { webStore } from "@/helpers/webStore";
import "./style.scss";

const FILTERS = Object.freeze([
  { id: "all", label: "Todas" },
  { id: "AVAILABLE", label: "Disponíveis" },
  { id: "OWNED", label: "Com campeão" },
  { id: "CHALLENGED", label: "Em disputa" },
]);

const STATUS_LABEL = Object.freeze({ AVAILABLE: "Disponível", OWNED: "Com campeão", CHALLENGED: "Em disputa" });

function formatActivity(value) {
  if (!value) return "Sem batalha recente";
  const hours = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000));
  if (hours < 1) return "Ativo agora";
  if (hours < 24) return `Última batalha há ${hours}h`;
  if (hours < BADGE_INACTIVITY_HOURS) return "Última batalha ontem";
  return "Aguardando atualização";
}

function historyText(event) {
  if (event.event_type === "INITIAL_CLAIM") return `${event.new_owner_name} se tornou o primeiro campeão.`;
  if (event.event_type === "TRANSFER") return `${event.new_owner_name} conquistou de ${event.previous_owner_name}.`;
  if (event.event_type === "DEFENSE") return `${event.new_owner_name || event.previous_owner_name} defendeu a Insígnia.`;
  if (event.event_type === "RELEASED_INACTIVITY") return `Liberada por inatividade de ${event.previous_owner_name}.`;
  if (event.event_type === "CHALLENGE_STARTED") return "Um novo desafio começou.";
  if (event.event_type === "CHALLENGE_FAILED") return "O desafio foi encerrado sem transferência.";
  return "Desafio concluído.";
}

function BadgeCard({ badge, playerId, onOpen }) {
  const config = badge.config;
  const mine = badge.owner_player_id === playerId;
  const challenge = badge.activeChallenge;
  return (
    <article className={`competitive-badge-card is-${badge.status.toLowerCase()}`} style={{ "--badge-color": config.color }}>
      <div className="competitive-badge-card__light" aria-hidden="true" />
      <BadgeArtwork badge={badge} decorative />
      <span className="competitive-badge-card__type">
        <img src={config.fallbackImage} alt="" aria-hidden="true" /> {config.localizedTypeName}
      </span>
      <h2>{config.name}</h2>
      <span className={`competitive-badge-status status-${badge.status.toLowerCase()}`}>
        {badge.status === "CHALLENGED" ? <Sword weight="fill" /> : badge.status === "OWNED" ? <Crown weight="fill" /> : <Trophy weight="fill" />}
        {mine ? "Sua Insígnia" : STATUS_LABEL[badge.status]}
      </span>
      <div className="competitive-badge-card__owner">
        {badge.status === "AVAILABLE" && <><strong>Sem campeão</strong><small>O título está esperando seu primeiro dono.</small></>}
        {badge.owner_player_id && <><strong>{badge.owner_display_name}</strong><small>{mine ? "Você é o campeão atual" : "Campeão atual"} · {badge.defense_count} {badge.defense_count === 1 ? "defesa" : "defesas"}</small></>}
        {challenge && <small className="competitive-badge-card__duel">{challenge.challenger_name} desafia {challenge.defender_name}</small>}
      </div>
      <button type="button" onClick={() => onOpen(badge)}>
        {badge.status === "AVAILABLE" ? "Conquistar" : badge.status === "CHALLENGED" ? "Acompanhar" : mine ? "Ver minha Insígnia" : "Ver e desafiar"}
      </button>
    </article>
  );
}

function BadgeDetail({ badge, history, profile, busy, onClose, onStart, onContinue }) {
  const closeRef = useRef(null);
  const config = badge.config;
  const mine = badge.owner_player_id === profile?.playerId;
  const challenge = badge.activeChallenge;
  const participant = challenge && [challenge.challenger_player_id, challenge.defender_player_id].includes(profile?.playerId);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);
  return (
    <div className="badge-detail-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="badge-detail" role="dialog" aria-modal="true" aria-labelledby="badge-detail-title" style={{ "--badge-color": config.color }}>
        <button ref={closeRef} type="button" className="badge-detail__close" onClick={onClose} aria-label="Fechar detalhes da Insígnia" disabled={busy}><X size={21} weight="bold" /></button>
        <header className="badge-detail__hero">
          <BadgeArtwork badge={badge} />
          <div><span className="eyebrow">{config.localizedTypeName.toUpperCase()}</span><h2 id="badge-detail-title">{config.name}</h2></div>
        </header>
        <section className="badge-detail__ownership" aria-label="Campeão da Insígnia">
          {badge.status === "AVAILABLE" && <><Trophy size={25} weight="fill" /><div><strong>Sem campeão</strong><p>Esta Insígnia está esperando seu primeiro campeão.</p></div></>}
          {badge.owner_player_id && <><Crown size={25} weight="fill" /><div><strong>{mine ? "Sua Insígnia" : badge.owner_display_name}</strong><p>{mine ? "Você é o atual campeão." : "Campeão atual"} · {badge.defense_count} {badge.defense_count === 1 ? "defesa" : "defesas"}</p><small>{formatActivity(badge.ownerLastBattleAt)}</small></div></>}
        </section>
        {challenge && <section className="badge-detail__challenge" aria-label="Desafio em andamento"><Sword size={23} weight="fill" /><div><strong>Em disputa</strong><p>{challenge.challenger_name} desafia {challenge.defender_name}</p><span>{challenge.challenger_wins}/{BADGE_REQUIRED_WINS} vitórias consecutivas · Batalha {challenge.current_battle}</span></div></section>}
        <section className="badge-detail__rules" aria-labelledby="badge-rules-title">
          <span className="eyebrow">FORMATO OFICIAL</span><h3 id="badge-rules-title">Regras do desafio</h3>
          <ul>
            <li><Check aria-hidden="true" /> Equipe de 3 Pokémon</li>
            <li><Check aria-hidden="true" /> Pelo menos 1 Pokémon {config.localizedTypeName}</li>
            <li><Check aria-hidden="true" /> Vença 4 batalhas consecutivas</li>
            <li><X aria-hidden="true" /> Pokémon Lendários ou Míticos</li>
          </ul>
        </section>
        <section className="badge-detail__benefit"><Coins size={25} weight="fill" aria-hidden="true" /><div><span className="eyebrow">BENEFÍCIO DO CAMPEÃO</span><strong>+25% de moedas em batalhas CPU e PvP elegíveis</strong></div></section>
        <section className="badge-detail__history" aria-labelledby="badge-history-title"><span className="eyebrow">HISTÓRICO</span><h3 id="badge-history-title">Disputas registradas</h3>{history === null ? <p>Carregando histórico...</p> : history.length ? <ol>{history.filter((event) => event.event_type !== "CHALLENGE_COMPLETED").map((event) => <li key={event.id}><ShieldCheck size={17} weight="fill" aria-hidden="true" /><div><strong>{historyText(event)}</strong><time dateTime={event.created_at}>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</time></div></li>)}</ol> : <p>A primeira conquista ainda está por vir.</p>}</section>
        <footer className="badge-detail__actions">
          {challenge && participant ? <button type="button" onClick={() => onContinue(challenge)} disabled={busy}>Entrar no desafio</button> : mine ? <p><Crown weight="fill" aria-hidden="true" /> Você não pode desafiar sua própria Insígnia.</p> : challenge ? <p><ClockCountdown aria-hidden="true" /> Acompanhe o placar enquanto a disputa acontece.</p> : <button type="button" onClick={() => onStart(badge)} disabled={busy}>{busy ? "Confirmando..." : badge.owner_player_id ? `Desafiar ${badge.owner_display_name}` : "Conquistar Insígnia"}</button>}
        </footer>
      </section>
    </div>
  );
}

export default function CompetitiveBadgesPage() {
  const router = useRouter();
  const [badges, setBadges] = useState(null);
  const [profile, setProfile] = useState(null);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try { setError(""); setBadges(await listBadges()); }
    catch { setError("Não foi possível carregar as Insígnias."); }
  }, []);

  useEffect(() => {
    let unsubscribe;
    void webStore.getLocalPlayerProfile().then(async (localProfile) => {
      setProfile(localProfile);
      try { await registerCompetitivePlayer(localProfile); await refresh(); unsubscribe = subscribeBadges(() => { void refresh(); }); }
      catch { setError("Não foi possível carregar as Insígnias."); }
    });
    return () => unsubscribe?.();
  }, [refresh]);

  useEffect(() => {
    if (!selected?.id) return;
    const current = badges?.find((badge) => badge.id === selected.id);
    if (current) setSelected(current);
  }, [badges, selected?.id]);

  const summary = useMemo(() => ({
    available: badges?.filter((badge) => badge.status === "AVAILABLE").length || 0,
    owned: badges?.filter((badge) => badge.status === "OWNED").length || 0,
    challenged: badges?.filter((badge) => badge.status === "CHALLENGED").length || 0,
  }), [badges]);
  const visible = useMemo(() => badges?.filter((badge) => filter === "all" || badge.status === filter) || [], [badges, filter]);

  async function openBadge(badge) {
    setSelected(badge); setHistory(null);
    try { setHistory(await getBadgeHistory(badge.id)); } catch { setHistory([]); }
  }
  async function beginChallenge(badge) {
    if (!profile) return;
    setBusy(true);
    try { const challenge = await startBadgeChallenge(badge.code, profile); router.push(`/batalha?badgeChallenge=${challenge.id}`); }
    catch (challengeError) { setError(challengeError.message); setSelected(null); await refresh(); }
    finally { setBusy(false); }
  }

  return (
    <main className="competitive-badges-page">
      <section className="competitive-badges-shell">
        <header className="competitive-badges-heading"><Link href="/jornada"><ArrowLeft size={20} /> Jornada</Link><span className="eyebrow">TÍTULOS COMPETITIVOS</span><h1>Insígnias</h1><p>Conquiste. Defenda. Domine. Cada tipo possui um único campeão entre todos os jogadores.</p></header>
        {error && <section className="competitive-badges-error" role="alert"><Warning size={28} weight="fill" /><div><strong>{error}</strong><p>Verifique sua conexão e tente novamente. Sua coleção local continua disponível.</p></div><button type="button" onClick={refresh}>Tentar novamente</button></section>}
        <section className="competitive-badges-summary" aria-label="Resumo das Insígnias"><article><Trophy weight="fill" /><strong>{BADGE_CONFIG.length}</strong><span>Insígnias</span></article><article><ShieldCheck weight="fill" /><strong>{summary.available}</strong><span>Disponíveis</span></article><article><Crown weight="fill" /><strong>{summary.owned}</strong><span>Com campeão</span></article><article><Sword weight="fill" /><strong>{summary.challenged}</strong><span>Em disputa</span></article></section>
        <div className="competitive-badges-filters" role="group" aria-label="Filtrar Insígnias">{FILTERS.map((item) => <button key={item.id} type="button" className={filter === item.id ? "selected" : ""} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</div>
        {!badges && !error && <div className="competitive-badges-grid is-loading" aria-label="Carregando Insígnias">{BADGE_CONFIG.map((badge) => <div key={badge.code} className="competitive-badge-skeleton" />)}</div>}
        {badges && !badges.length && <section className="competitive-badges-empty"><Trophy size={38} weight="fill" /><h2>As Insígnias ainda não foram preparadas</h2><p>Aplique a migração do sistema competitivo no Supabase e tente novamente.</p></section>}
        {badges && badges.length > 0 && <div className="competitive-badges-grid">{visible.map((badge) => <BadgeCard key={badge.id} badge={badge} playerId={profile?.playerId} onOpen={openBadge} />)}</div>}
        {badges && visible.length === 0 && <p className="competitive-badges-no-filter">Nenhuma Insígnia corresponde a este filtro agora.</p>}
      </section>
      {selected && <BadgeDetail badge={selected} history={history} profile={profile} busy={busy} onClose={() => setSelected(null)} onStart={beginChallenge} onContinue={(challenge) => router.push(`/batalha?badgeChallenge=${challenge.id}`)} />}
    </main>
  );
}
