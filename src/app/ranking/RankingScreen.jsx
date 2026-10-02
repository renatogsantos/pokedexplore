"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowClockwise, Crown, Lightning, Medal, Sword, Trophy, X } from "@phosphor-icons/react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { webStore } from "@/helpers/webStore";
import { getPublicTrainer, getTrainerRanking, syncRankingProfile } from "@/lib/ranking/service";
import { POKEMON_MASTER_TITLE } from "@/lib/profile/pokemonMaster";
import "./style.scss";

const number = value => new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
function Title({ trainer }) { return trainer.title ? <span className="ranking-master"><Crown size={14} weight="fill" aria-hidden="true" />{trainer.title}</span> : <span className="ranking-trainer-title">Treinador</span>; }
function Power({ value }) { return <span className="ranking-power"><Lightning weight="fill" aria-hidden="true" />{number(value)} <small>Poder</small></span>; }

function TrainerRow({ trainer, playerId, onOpen, compact = false }) {
  const mine = trainer.player_id === playerId;
  return <button type="button" className={`ranking-row${mine ? " is-current" : ""}${compact ? " is-compact" : ""}`} onClick={event=>onOpen(trainer,event.currentTarget)} aria-label={`Ver perfil público de ${trainer.display_name}, posição ${trainer.position}`}>
    <span className="ranking-position">#{String(trainer.position).padStart(2,"0")}</span>
    <PlayerAvatar avatarId={trainer.avatar_id} />
    <span className="ranking-identity"><strong title={trainer.display_name}><span className="ranking-name">{trainer.display_name}</span>{mine && <small>VOCÊ</small>}</strong><Title trainer={trainer} /><Power value={trainer.trainer_power} />
      {!compact && <span className="ranking-row-stats"><span><Medal aria-hidden="true" />{trainer.badges_current}/18</span><span>{number(trainer.wins)} vitórias</span><span>{trainer.win_rate}% vitórias</span></span>}
    </span>
  </button>;
}

function TrainerDetails({ trainer, onClose }) {
  const [fresh, setFresh] = useState(trainer);
  const [error, setError] = useState(false);
  const dialog = useRef(null);
  useEffect(()=>{
    let active=true;
    dialog.current?.showModal();
    void getPublicTrainer(trainer.player_id).then(value=>{if(active && value) setFresh(value);}).catch(()=>{if(active) setError(true);});
    return ()=>{active=false;};
  },[trainer.player_id]);
  const stats = [["Partidas",fresh.total_battles],["Vitórias",fresh.wins],["Taxa de vitória",`${fresh.win_rate}%`],["Vitórias PvP",fresh.pvp_wins],["Campeonatos vencidos",fresh.tournament_wins],["Finais",fresh.tournament_finals],["Insígnias atuais",`${fresh.badges_current}/18`],["Defesas",fresh.badge_defenses],["Sequência atual",fresh.current_win_streak],["Melhor sequência",fresh.best_win_streak]];
  return <dialog ref={dialog} className="ranking-dialog" role="dialog" aria-labelledby="public-trainer-name" onCancel={event=>{event.preventDefault();dialog.current?.close();onClose();}}>
    <button type="button" className="ranking-dialog-close" onClick={()=>{dialog.current?.close();onClose();}} aria-label="Fechar perfil público"><X size={24} aria-hidden="true" /></button>
    <PlayerAvatar avatarId={fresh.avatar_id} eager />
    <span className="ranking-eyebrow">PERFIL PÚBLICO · #{fresh.position}</span>
    <h2 id="public-trainer-name">{fresh.display_name}</h2>
    <Title trainer={fresh} /><Power value={fresh.trainer_power} />
    <dl>{stats.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{typeof value==="number"?number(value):value}</dd></div>)}</dl>
    {error && <p role="status">Exibindo os dados carregados no ranking. Atualize a página para tentar novamente.</p>}
  </dialog>;
}

export default function RankingScreen() {
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const opener = useRef(null);
  const request = useRef(0);
  const moreBusy = useRef(false);
  const mounted = useRef(false);
  const load = useCallback(async (append=false, offset=3) => {
    if (append && moreBusy.current) return;
    moreBusy.current=append;
    const generation=++request.current;
    setError(false);
    if(append) setLoadingMore(true); else setLoading(true);
    try {
      const identity=await webStore.getLocalPlayerProfile();
      await syncRankingProfile(identity);
      const result=await getTrainerRanking(identity.playerId,offset);
      if(!mounted.current || generation!==request.current) return;
      setProfile(identity);
      setData(previous=>({...result,rows:append ? [...new Map([...(previous?.rows||[]),...result.rows].map(row=>[row.player_id,row])).values()] : result.rows}));
    } catch { if(mounted.current && generation===request.current) setError(true); }
    finally { if(mounted.current && generation===request.current) {setLoading(false);setLoadingMore(false);moreBusy.current=false;} }
  },[]);
  useEffect(()=>{mounted.current=true;void load();return ()=>{mounted.current=false;request.current++;};},[load]);
  const open = (trainer, element) => {opener.current=element;setSelected(trainer);};
  const close = () => {setSelected(null);opener.current?.focus();};
  const visible = [...(data?.top3||[]),...(data?.rows||[])].some(row=>row.player_id===profile?.playerId);
  return <main className="ranking-page" id="main-content"><div className="ranking-shell">
    <header className="ranking-topbar"><Link href="/perfil"><ArrowLeft size={20} aria-hidden="true" />Perfil</Link><button type="button" onClick={()=>void load()} disabled={loading} aria-label="Atualizar ranking"><ArrowClockwise size={22} aria-hidden="true" /></button></header>
    <section className="ranking-heading"><span className="ranking-eyebrow">POKÉDEXPLORE · GERAL</span><h1>RANKING DE<br />TREINADORES</h1><p>Os treinadores mais fortes do PokédExplore</p><span className="ranking-heading-tag"><Trophy size={16} weight="fill" aria-hidden="true" />PODER DO TREINADOR</span></section>
    {loading ? <div className="ranking-loading" aria-label="Carregando ranking" role="status"><div className="ranking-podium">{[0,1,2].map(i=><span className="ranking-skeleton podium" key={i} />)}</div>{[0,1,2,3].map(i=><span className="ranking-skeleton row" key={i} />)}</div> : <>
      {error && <section className="ranking-message" role="alert"><p>Não foi possível carregar o ranking.</p><button type="button" onClick={()=>void load()}>TENTAR NOVAMENTE</button></section>}
      {!error && !data?.total && <section className="ranking-message"><Trophy size={36} aria-hidden="true" /><p>Nenhum treinador entrou no ranking ainda.</p></section>}
      {data?.total>0 && <>
        <section className="ranking-podium" aria-label="Top 3 treinadores">{[2,1,3].map(position=>{
          const trainer=data.top3.find(row=>row.position===position);
          return trainer ? <button key={position} type="button" className={`ranking-podium-card place-${position}${trainer.title===POKEMON_MASTER_TITLE?" is-master":""}`} onClick={event=>open(trainer,event.currentTarget)} aria-label={`Ver perfil público de ${trainer.display_name}, posição ${position}`}>
            <span className="podium-rank">{position===1 && <Crown size={22} weight="fill" aria-hidden="true" />}#{position}</span><PlayerAvatar avatarId={trainer.avatar_id} eager />
            <strong title={trainer.display_name}>{trainer.display_name}</strong>{trainer.player_id===profile?.playerId && <span className="podium-you">VOCÊ</span>}<Title trainer={trainer} /><Power value={trainer.trainer_power} /><span className="podium-badges"><Medal size={16} aria-hidden="true" />{trainer.badges_current}/18</span>
          </button> : <div key={position} className={`ranking-podium-card is-vacant place-${position}`}><span className="podium-rank">#{position}</span><span>Em aberto</span></div>;
        })}</section>
        <section className="ranking-list" aria-labelledby="ranking-list-heading"><div className="ranking-section-heading"><h2 id="ranking-list-heading">Treinadores</h2><span>{number(data.total)} no ranking</span></div>
          {data.rows.map(trainer=><TrainerRow key={trainer.player_id} trainer={trainer} playerId={profile?.playerId} onOpen={open} />)}
          {data.nextOffset!==null && <button type="button" className="ranking-more" disabled={loadingMore} onClick={()=>void load(true,data.nextOffset)}>{loadingMore?"CARREGANDO…":"VER MAIS TREINADORES"}</button>}
        </section>
        {!visible && data.current && <aside className="ranking-own" aria-label="Sua posição"><span>SUA POSIÇÃO</span><TrainerRow trainer={data.current} playerId={profile?.playerId} onOpen={open} compact /></aside>}
      </>}
    </>}
    <p className="ranking-footnote">Ranking social · Resultados registrados a partir da ativação do sistema.</p>
    {selected && <TrainerDetails key={selected.player_id} trainer={selected} onClose={close} />}
  </div></main>;
}
