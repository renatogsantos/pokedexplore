"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Crown, LockKey, MapTrifold, Medal, Play, Sparkle, Trophy } from "@phosphor-icons/react";
import { webStore } from "@/helpers/webStore";
import { JOURNEY_CHAPTERS, JOURNEY_MEDALS, JOURNEY_ROUTES, getJourneyRoute, isJourneyNodeUnlocked } from "@/lib/journey";
import { getItemDefinition } from "@/lib/items/catalog";
import "./style.scss";

const EMPTY_PROGRESS = { journeyCompleted: [], journeyMedals: [], journeyPerfectRoutes: [], activeExpedition: null, wins: 0, trainerXp: 0 };

function RouteStatus({ route, progress, onStart, busy }) {
  const completed = progress.journeyCompleted.includes(route.id);
  const unlocked = isJourneyNodeUnlocked(route.id, progress.journeyCompleted, progress.journeyMedals);
  const active = progress.activeExpedition?.routeId === route.id && progress.activeExpedition?.status !== "completed";
  const battle = active ? progress.activeExpedition.currentBattle : 1;
  const perfect = progress.journeyPerfectRoutes.includes(route.id);
  const action = active ? "Continuar expedição" : completed ? "Repetir rota" : "Iniciar expedição";
  return <article className={`journey-map-node ${completed ? "is-complete" : ""} ${active ? "is-active" : ""} ${!unlocked ? "is-locked" : ""}`}>
    <div className="journey-map-node__marker" aria-hidden="true">{!unlocked ? <LockKey weight="fill" /> : route.medalId ? <Medal weight="fill" /> : route.champion ? <Crown weight="fill" /> : completed ? <Check weight="bold" /> : <MapTrifold weight="fill" />}</div>
    <div className="journey-map-node__content">
      <span>{route.champion ? "DESAFIO FINAL" : route.medalId ? "GINÁSIO" : `ROTA · CAPÍTULO ${route.chapter}`}</span>
      <h2>{route.title}</h2><p>{route.subtitle}</p>
      <ul aria-label={`Recompensas de ${route.title}`}><li>3 batalhas</li><li>{completed ? "Recompensas de repetição" : "Baú no chefe"}</li>{perfect && <li>Rota perfeita</li>}</ul>
      {active && <strong className="journey-map-node__progress">EXPEDIÇÃO EM ANDAMENTO · BATALHA {battle}/3</strong>}
    </div>
    {unlocked ? <button type="button" onClick={() => onStart(route.id)} disabled={busy} aria-label={`${action}: ${route.title}`}>{busy ? "Preparando..." : <>{action} <ArrowRight weight="bold" /></>}</button> : <span className="journey-map-node__locked">{route.champion ? "3 medalhas necessárias" : "Conclua a rota anterior"}</span>}
  </article>;
}

function ExpeditionPanel({ active, onContinue, busy }) {
  const route = getJourneyRoute(active?.routeId); if (!route) return null;
  const earned = active.completedBattles || [];
  return <section className="journey-expedition-panel" aria-labelledby="expedition-title">
    <div><span className="eyebrow">EXPEDIÇÃO ATIVA</span><h2 id="expedition-title">{route.title}</h2><p>Você pode ajustar seu time, usar um deck e trocar itens equipados antes da próxima batalha.</p></div>
    <ol aria-label="Progresso da expedição">{route.battles.map((battle) => <li key={battle.index} className={earned.includes(battle.index) ? "done" : battle.index === active.currentBattle ? "next" : ""}><span>{earned.includes(battle.index) ? <Check weight="bold" /> : battle.index}</span><strong>{battle.index === 3 ? "BATALHA FINAL" : `BATALHA ${battle.index}`} · {battle.label}</strong></li>)}</ol>
    <button type="button" onClick={onContinue} disabled={busy}><Play weight="fill" /> Continuar na batalha {active.currentBattle}/3</button>
  </section>;
}

export default function JourneyPage() {
  const router = useRouter(); const params = useSearchParams();
  const [progress, setProgress] = useState(EMPTY_PROGRESS); const [busy, setBusy] = useState(false); const [feedback, setFeedback] = useState("");
  const refresh = async () => { const economy = await webStore.getEconomy(); setProgress(economy.progress || EMPTY_PROGRESS); };
  useEffect(() => { void refresh(); }, []);
  const chapter = useMemo(() => JOURNEY_CHAPTERS.find((item) => item.routeIds.some((id) => !progress.journeyCompleted.includes(id))) || JOURNEY_CHAPTERS.at(-1), [progress.journeyCompleted]);
  const active = progress.activeExpedition?.status !== "completed" ? progress.activeExpedition : null;
  useEffect(() => { if (params.get("expedition") && active) setFeedback("Sua expedição foi salva. Prepare-se para a próxima batalha."); }, [active, params]);
  async function launch(routeId) {
    if (active && active.routeId !== routeId) { setFeedback("Conclua ou retome a expedição atual antes de iniciar outra rota."); return; }
    setBusy(true); setFeedback("");
    const result = await webStore.startJourneyExpedition(routeId); setBusy(false);
    if (!result.ok) { setFeedback("Não foi possível preparar esta expedição agora."); return; }
    setProgress((current) => ({ ...current, activeExpedition: result.active }));
    router.push(`/batalha?journey=${routeId}&journeyBattle=${result.active.currentBattle}`);
  }
  const lastResult = progress.lastJourneyResult;
  return <main className="journey-page"><section className="journey-shell">
    <header className="journey-hero"><div><span className="eyebrow">JORNADA</span><h1>{chapter?.title}</h1><p>Complete expedições de três batalhas, vença chefes e fortaleça sua equipe para os desafios competitivos.</p></div><Link href="/jornada/insignias" className="journey-competitive-link"><Crown weight="fill" /> Insígnias competitivas</Link></header>
    <section className="journey-status" aria-label="Resumo da Jornada"><article><MapTrifold weight="fill" /><strong>{progress.journeyCompleted.length}/{JOURNEY_ROUTES.length - 1}</strong><span>rotas concluídas</span></article><article><Medal weight="fill" /><strong>{progress.journeyMedals.length}/3</strong><span>medalhas da Jornada</span></article><article><Sparkle weight="fill" /><strong>{progress.journeyPerfectRoutes.length}</strong><span>rotas perfeitas</span></article></section>
    {feedback && <p className="journey-feedback" role="status">{feedback}</p>}
    {active && <ExpeditionPanel active={active} busy={busy} onContinue={() => launch(active.routeId)} />}
    {lastResult && !active && <section className="journey-reward-panel" aria-labelledby="journey-reward-title"><Trophy weight="fill" aria-hidden="true" /><div><span className="eyebrow">BAÚ DA JORNADA</span><h2 id="journey-reward-title">Expedição concluída</h2><p>+{lastResult.reward.coins + lastResult.chest.coins} moedas{lastResult.chest.itemId ? ` · ${getItemDefinition(lastResult.chest.itemId)?.name || "item encontrado"}` : ""}{lastResult.perfect ? " · Rota perfeita" : ""}</p></div>{lastResult.medal && <strong><Medal weight="fill" /> Medalha conquistada</strong>}</section>}
    <section className="journey-medals" aria-labelledby="journey-medals-title"><div><span className="eyebrow">PROGRESSO PESSOAL</span><h2 id="journey-medals-title">Medalhas da Jornada</h2><p>São permanentes, pessoais e independentes das Insígnias competitivas.</p></div><div>{JOURNEY_MEDALS.map((medal) => { const earned = progress.journeyMedals.includes(medal.id); return <article key={medal.id} className={earned ? "earned" : ""}><Medal weight={earned ? "fill" : "regular"} /><span>{medal.name}</span><small>{earned ? "Conquistada" : "Bloqueada"}</small></article>; })}</div></section>
    <section className="journey-map" aria-label="Mapa de expedições"><header><span className="eyebrow">MAPA DA AVENTURA</span><h2>Seu próximo destino</h2><p>Rota perfeita: complete as três batalhas sem nenhum Pokémon desmaiar para melhorar o baú.</p></header>{JOURNEY_CHAPTERS.map((chapterItem) => <section className="journey-chapter" key={chapterItem.id} aria-label={`Capítulo ${chapterItem.id}: ${chapterItem.title}`}><h3>CAPÍTULO {chapterItem.id} · {chapterItem.title}</h3>{chapterItem.routeIds.map((routeId) => <RouteStatus key={routeId} route={getJourneyRoute(routeId)} progress={progress} onStart={launch} busy={busy} />)}</section>)}</section>
  </section></main>;
}
