"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Fire, Lightning, LockKey, MapTrifold, Medal, ShieldCheck, Trophy } from "@phosphor-icons/react";
import BadgeArtwork from "@/components/Badges/BadgeArtwork";
import { BADGE_CONFIG } from "@/lib/badges/config";
import { hasBadgeServiceConfig, listBadges, registerCompetitivePlayer, subscribeBadges } from "@/lib/badges/service";
import { webStore } from "@/helpers/webStore";
import { JOURNEY_NODES, isJourneyNodeUnlocked } from "@/lib/journey";
import { ACHIEVEMENTS } from "@/lib/journey/achievements";
import "./style.scss";

const achievementIcon = { trophy: Trophy, lightning: Lightning, shield: ShieldCheck, fire: Fire };

export default function JourneyPage() {
  const [progress, setProgress] = useState({ journeyCompleted: [], badges: [], achievements: {}, streak: 0, bestStreak: 0, wins: 0, totalBattles: 0 });
  const [competitiveBadges, setCompetitiveBadges] = useState(null);
  const restoreInput = useRef(null);
  const refreshProgress = async () => { const economy = await webStore.getEconomy(); setProgress(economy.progress); };
  const refreshCompetitive = useCallback(async () => {
    if (!hasBadgeServiceConfig()) return setCompetitiveBadges(null);
    try { setCompetitiveBadges(await listBadges()); } catch { setCompetitiveBadges(null); }
  }, []);

  useEffect(() => {
    let unsubscribe;
    void refreshProgress();
    if (hasBadgeServiceConfig()) void webStore.getLocalPlayerProfile().then(async (profile) => {
      try { await registerCompetitivePlayer(profile); await refreshCompetitive(); unsubscribe = subscribeBadges(() => { void refreshCompetitive(); }); } catch {}
    });
    return () => unsubscribe?.();
  }, [refreshCompetitive]);

  async function downloadBackup() {
    const backup = await webStore.exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "pokedexplore-backup.json"; link.click(); URL.revokeObjectURL(url);
  }

  async function restoreBackup(event) {
    const file = event.target.files?.[0]; if (!file) return;
    try { await webStore.importBackup(JSON.parse(await file.text())); await refreshProgress(); }
    catch { window.alert("Não foi possível restaurar este backup."); }
    finally { event.target.value = ""; }
  }

  const badges = progress.badges || [];
  const gymBadges = JOURNEY_NODES.filter((node) => node.badge);
  const unlockedAchievements = Object.keys(progress.achievements || {}).filter((id) => progress.achievements[id]).length;
  const champions = competitiveBadges?.filter((badge) => badge.owner_player_id).length || 0;
  const disputed = competitiveBadges?.filter((badge) => badge.status === "CHALLENGED").length || 0;
  const previewBadges = competitiveBadges?.slice(0, 5) || BADGE_CONFIG.slice(0, 5);

  return (
    <main className="journey-page">
      <section className="journey-shell">
        <header className="journey-heading"><div><span className="eyebrow">JORNADA</span><h1>Seu próximo desafio</h1><p>Vença encontros, mantenha a sequência e transforme cada vitória em progresso.</p></div><section className="backup-actions" aria-label="Backup da progressão"><button type="button" onClick={downloadBackup}>Baixar backup</button><button type="button" onClick={() => restoreInput.current?.click()}>Restaurar backup</button><input ref={restoreInput} type="file" accept="application/json" onChange={restoreBackup} /></section></header>
        <section className="journey-summary" aria-label="Resumo de batalha"><article><Trophy weight="fill" /><strong>{progress.wins || 0}</strong><span>vitórias</span></article><article><Fire weight="fill" /><strong>{progress.streak || 0}</strong><span>sequência atual</span></article><article><Lightning weight="fill" /><strong>{progress.bestStreak || 0}</strong><span>melhor sequência</span></article><article><Medal weight="fill" /><strong>{unlockedAchievements}/{ACHIEVEMENTS.length}</strong><span>conquistas</span></article></section>
        <section className="competitive-badges-preview" aria-labelledby="competitive-badges-title">
          <div className="competitive-badges-preview__copy"><span className="eyebrow">CAMPEONATO COMPETITIVO</span><h2 id="competitive-badges-title">Insígnias</h2><p>Títulos únicos disputados entre os jogadores. Conquiste quatro vitórias seguidas e defenda seu reinado.</p><div className="competitive-badges-preview__status">{competitiveBadges ? <><span><Crown weight="fill" /> {champions} com campeão</span><span><ShieldCheck weight="fill" /> {disputed} em disputa</span></> : <span>Status compartilhado disponível com o serviço online.</span>}</div><Link href="/jornada/insignias">Ver Insígnias</Link></div>
          <div className="competitive-badges-preview__art" aria-hidden="true">{previewBadges.map((badge, index) => <BadgeArtwork key={badge.code || badge.type} badge={badge} decorative className={`preview-badge preview-badge-${index + 1}`} />)}</div>
        </section>
        <section className="achievement-case" aria-labelledby="achievement-title"><div className="section-title"><span className="eyebrow">CONQUISTAS</span><h2 id="achievement-title">Metas de treinador</h2><p>Cada conquista paga a recompensa apenas uma vez.</p></div><div className="achievement-grid">{ACHIEVEMENTS.map((achievement) => { const earned = Boolean(progress.achievements?.[achievement.id]); const Icon = achievementIcon[achievement.icon] || Trophy; return <article key={achievement.id} className={earned ? "achievement earned" : "achievement"}><div><Icon size={22} weight={earned ? "fill" : "regular"} /></div><section><strong>{achievement.name}</strong><p>{achievement.description}</p><small>{earned ? "Conquistada" : "Em progresso"} · +{achievement.reward} moedas</small></section>{!earned && <LockKey className="achievement-lock" size={17} />}</article>; })}</div></section>
        <section className="badge-case" aria-labelledby="badge-title"><div><span className="eyebrow">INSÍGNIAS DA JORNADA</span><h2 id="badge-title">{badges.length}/{gymBadges.length} conquistadas</h2></div><div className="badge-list">{gymBadges.map((node) => { const earned = badges.includes(node.badge); return <div key={node.badge} className={earned ? "badge earned" : "badge"} aria-label={earned ? node.badge + " conquistada" : node.badge + " bloqueada"}><Medal size={24} weight={earned ? "fill" : "regular"} /><span>{node.badge}</span></div>; })}</div></section>
        <div className="journey-path">{JOURNEY_NODES.map((node) => { const completed = progress.journeyCompleted?.includes(node.id); const unlocked = isJourneyNodeUnlocked(node.id, progress.journeyCompleted); return <article key={node.id} className={`journey-node ${completed ? "completed" : ""}${!unlocked ? " locked" : ""}`}><div className="journey-node-icon">{!unlocked ? <LockKey size={25} /> : node.badge ? <Medal size={25} weight="fill" /> : <MapTrifold size={25} weight="fill" />}</div><div><span>{node.badge ? "GINÁSIO" : "ENCONTRO"} · Nv. {node.level}</span><h2>{node.title}</h2><p>{node.subtitle} · +{node.reward} moedas</p>{node.badge && <small>Insígnia: {node.badge}</small>}</div>{unlocked && <Link href={`/batalha?journey=${node.id}`}>{completed ? "Repetir" : "Desafiar"}</Link>}</article>; })}</div>
      </section>
    </main>
  );
}
