"use client";

import { Crown, LinkSimple, Play, Trophy, Users, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { ROUND, TOURNAMENT_CONFIG, TOURNAMENT_STATUS } from "@/lib/tournament/config";
import { celebrateBattleVictory } from "@/lib/celebration";

const playerById = (tournament, id) => tournament?.tournament_players?.find((player) => player.player_id === id) || null;
const playerName = (tournament, id) => playerById(tournament, id)?.display_name || "Aguardando";
const statusName = (match) => match?.status === "FINISHED" ? "FINALIZADA" : match?.status === "PLAYING" ? "EM BATALHA" : match?.status === "READY" ? "PRONTA" : "AGUARDANDO";

function ArenaPlayer({ player, localId, winnerId, compact = false }) {
  const isLocal = player?.player_id === localId;
  const isWinner = player?.player_id && player.player_id === winnerId;
  if (!player) return <div className={`arena-player is-pending ${compact ? "is-compact" : ""}`}><span className="arena-player__unknown" aria-hidden="true">?</span><strong>Aguardando</strong></div>;
  return <div className={`arena-player ${isLocal ? "is-local" : ""} ${isWinner ? "is-winner" : ""} ${compact ? "is-compact" : ""}`}>
    <PlayerAvatar avatarId={player.avatar_id} eager alt={`Avatar de ${player.display_name}`} className="arena-player__avatar" />
    <strong title={player.display_name}>{player.display_name}</strong>
    {isLocal && <small>VOCÊ</small>}
    {isWinner && <small>VENCEDOR</small>}
  </div>;
}

function MatchCard({ tournament, match, playerId, onEnter, final = false, index = 0 }) {
  const mine = match && [match.player1_id, match.player2_id].includes(playerId);
  const finished = match?.status === "FINISHED";
  const ready = match?.status === "READY";
  const playing = match?.status === "PLAYING";
  const one = playerById(tournament, match?.player1_id);
  const two = playerById(tournament, match?.player2_id);
  const reward = final ? TOURNAMENT_CONFIG.rewards.final : TOURNAMENT_CONFIG.rewards.semifinal;
  const label = mine && !finished ? final ? "SUA FINAL" : "SUA SEMIFINAL" : final ? "FINAL" : `SEMIFINAL ${index + 1}`;
  const enterLabel = final ? `Entrar na final contra ${playerName(tournament, match?.player1_id === playerId ? match?.player2_id : match?.player1_id)}` : `Entrar na semifinal contra ${playerName(tournament, match?.player1_id === playerId ? match?.player2_id : match?.player1_id)}`;
  return <article className={`arena-match ${final ? "is-final" : ""} ${mine && !finished ? "is-current" : ""} ${finished ? "is-finished" : ""} ${playing ? "is-playing" : ""}`}>
    <header><span>{label}</span><small className={`arena-match__state ${ready ? "is-ready" : playing ? "is-playing" : finished ? "is-finished" : ""}`}>{statusName(match)}</small></header>
    <div className="arena-match__duel">
      <ArenaPlayer player={one} localId={playerId} winnerId={match?.winner_id} compact={!final} />
      <b aria-hidden="true">VS</b>
      <ArenaPlayer player={two} localId={playerId} winnerId={match?.winner_id} compact={!final} />
    </div>
    <footer>{final ? <Crown size={16} weight="fill" aria-hidden="true" /> : <Trophy size={16} weight="fill" aria-hidden="true" />} +{reward}</footer>
    {mine && !finished && <button type="button" onClick={() => onEnter(match)} aria-label={enterLabel}><Play size={18} weight="fill" aria-hidden="true" /> {final ? "Entrar na final" : "Entrar na batalha"}</button>}
  </article>;
}

function Champion({ champion, code, playerId }) {
  return <section className={`arena-champion ${champion ? "has-champion" : ""}`} aria-label={champion ? `Campeão: ${champion.display_name}` : "Campeão aguardando a final"}>
    <Crown size={champion ? 34 : 26} weight="fill" aria-hidden="true" />
    {champion ? <><PlayerAvatar avatarId={champion.avatar_id} eager alt={`Avatar de ${champion.display_name}`} className="arena-champion__avatar" /><strong>{champion.display_name}</strong><small>{champion.player_id === playerId ? "VOCÊ É CAMPEÃO" : "CAMPEÃO"}</small><em>CAMPEÃO DO {code}</em></> : <><span>CAMPEÃO</span><strong>Aguardando a final</strong></>}
  </section>;
}

function TournamentBracket({ tournament, playerId, onEnterMatch }) {
  const matches = Array.isArray(tournament?.tournament_matches) ? tournament.tournament_matches : [];
  const semis = matches.filter((match) => match.round === ROUND.SEMIFINAL).sort((a, b) => a.round_index - b.round_index);
  const final = matches.find((match) => match.round === ROUND.FINAL);
  const champion = (Array.isArray(tournament?.tournament_players) ? tournament.tournament_players : []).find((player) => player.status === "CHAMPION");
  return <section className="tournament-arena" aria-label="Chave do campeonato">
    <Champion champion={champion} code={tournament.code} playerId={playerId} />
    <i className={`arena-link arena-link--champion ${final?.winner_id ? "is-complete" : ""}`} aria-hidden="true" />
    <div className="arena-final"><MatchCard tournament={tournament} match={final} playerId={playerId} onEnter={onEnterMatch} final /></div>
    <div className="arena-final-lines" aria-hidden="true"><i className={semis[0]?.winner_id ? "is-complete" : ""} /><i className={semis[1]?.winner_id ? "is-complete" : ""} /></div>
    <div className="arena-semis">{[0, 1].map((index) => <div className="arena-semi" key={index}><MatchCard tournament={tournament} match={semis[index]} playerId={playerId} onEnter={onEnterMatch} index={index} /></div>)}</div>
  </section>;
}

function TournamentOptions({ canCancel, mine, status, busy, onCancel, onLeave }) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  if (!canCancel && !(mine && status === TOURNAMENT_STATUS.LOBBY)) return null;
  return <section className="tournament-options"><span>OPÇÕES DO CAMPEONATO</span>
    {canCancel && (confirmingCancel ? <div><p>Cancelar interrompe a chave para todos e não pode ser desfeito.</p><button type="button" className="tournament-cancel-confirm" disabled={busy} onClick={onCancel}>Confirmar cancelamento</button><button type="button" className="tournament-back" onClick={() => setConfirmingCancel(false)}>Manter campeonato</button></div> : <button type="button" className="tournament-cancel-button" disabled={busy} onClick={() => setConfirmingCancel(true)}><XCircle size={18} aria-hidden="true" /> Cancelar campeonato</button>)}
    {!canCancel && mine && status === TOURNAMENT_STATUS.LOBBY && (confirmingLeave ? <div><p>Sair libera sua vaga neste lobby.</p><button type="button" className="tournament-cancel-confirm" disabled={busy} onClick={onLeave}>Confirmar saída</button><button type="button" className="tournament-back" onClick={() => setConfirmingLeave(false)}>Manter participação</button></div> : <button type="button" className="tournament-cancel-button" disabled={busy} onClick={() => setConfirmingLeave(true)}><XCircle size={18} aria-hidden="true" /> Sair do campeonato</button>)}
  </section>;
}

export default function TournamentPanel({ tournament, profile = {}, name, setName, code, setCode, notice, busy, onCreate, onJoin, onResetIdentity, onStart, onCancel, onLeave, onEnterMatch, onBack }) {
  const [confirmingStart, setConfirmingStart] = useState(false);
  const announcedChampion = useRef(null);
  const champion = (Array.isArray(tournament?.tournament_players) ? tournament.tournament_players : []).find((player) => player.status === "CHAMPION");
  useEffect(() => {
    if (champion?.player_id !== profile?.playerId || announcedChampion.current === champion.player_id) return;
    announcedChampion.current = champion.player_id;
    celebrateBattleVictory();
  }, [champion?.player_id, profile?.playerId]);
  if (!tournament) return <section className="battle-panel friend-panel tournament-panel">
    <span className="eyebrow">CAMPEONATO ONLINE</span><h2>Entre com seu treinador</h2><p>4 jogadores · 2 semifinais · 1 final</p>
    <div className="tournament-rewards"><span><Trophy size={20} weight="fill" aria-hidden="true" /> Semifinal <b>+{TOURNAMENT_CONFIG.rewards.semifinal}</b></span><span><Crown size={20} weight="fill" aria-hidden="true" /> Final <b>+{TOURNAMENT_CONFIG.rewards.final}</b></span></div>
    <label>Seu nome<input maxLength="18" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Renato" /></label>
    <div className="friend-actions tournament-entry"><button type="button" onClick={onCreate} disabled={busy}><LinkSimple size={24} aria-hidden="true" /> Criar campeonato</button><div><label>Código do campeonato<span className="room-code-input"><b aria-hidden="true">PKC-</b><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" maxLength="4" placeholder="1234" aria-label="Quatro números do código do campeonato" /></span></label><button type="button" onClick={onJoin} disabled={busy}>Entrar</button></div></div>
    {process.env.NODE_ENV !== "production" && <button type="button" className="tournament-back" onClick={onResetIdentity}>Gerar nova identidade local</button>}{notice && <p className="setup-notice" role="status">{notice}</p>}<button type="button" className="tournament-back" onClick={onBack}>Voltar</button>
  </section>;

  const players = Array.isArray(tournament.tournament_players) ? tournament.tournament_players : []; const isOrganizer = tournament.created_by_player_id === profile.playerId; const mine = players.find((player) => player.player_id === profile.playerId);
  const canCancel = isOrganizer && [TOURNAMENT_STATUS.LOBBY, TOURNAMENT_STATUS.SEMIFINALS, TOURNAMENT_STATUS.FINAL].includes(tournament.status);
  const status = tournament.status === TOURNAMENT_STATUS.SEMIFINALS ? "SEMIFINAIS" : tournament.status === TOURNAMENT_STATUS.FINAL ? "FINAL" : tournament.status === TOURNAMENT_STATUS.FINISHED ? "FINALIZADO" : tournament.status === TOURNAMENT_STATUS.CANCELLED ? "CANCELADO" : "AGUARDANDO";
  return <section className="battle-panel tournament-panel tournament-lobby">
    <header className="tournament-arena-header"><div><span className="eyebrow"><Trophy size={15} weight="fill" aria-hidden="true" /> CAMPEONATO</span><h2>{tournament.code}</h2><small>{status} · {players.length}/4 JOGADORES</small></div><span className="tournament-count"><Users size={18} weight="fill" aria-hidden="true" /> {players.length}/4</span></header>
    {tournament.status === TOURNAMENT_STATUS.LOBBY && <section className="tournament-lobby-roster"><h3>{isOrganizer ? players.length === 4 ? "Arena pronta" : "Aguardando treinadores" : "Aguardando o início"}</h3><div>{[1, 2, 3, 4].map((slot) => { const player = players.find((entry) => entry.slot === slot); return player ? <ArenaPlayer key={slot} player={player} localId={profile.playerId} compact /> : <ArenaPlayer key={slot} compact />; })}</div>{isOrganizer && (confirmingStart ? <div className="tournament-confirm"><p>Iniciar bloqueia os 4 participantes e cria a chave.</p><button type="button" className="tournament-primary" disabled={busy} onClick={onStart}>Confirmar início</button><button type="button" className="tournament-back" onClick={() => setConfirmingStart(false)}>Voltar</button></div> : <button type="button" className="tournament-primary" disabled={players.length !== 4 || busy} onClick={() => setConfirmingStart(true)}>Iniciar campeonato</button>)}</section>}
    {[TOURNAMENT_STATUS.SEMIFINALS, TOURNAMENT_STATUS.FINAL, TOURNAMENT_STATUS.FINISHED].includes(tournament.status) && <TournamentBracket tournament={tournament} playerId={profile.playerId} onEnterMatch={onEnterMatch} />}
    {mine?.status === "ELIMINATED" && <p className="tournament-status"><WarningCircle size={18} aria-hidden="true" /> Eliminado. Acompanhe o desfecho da chave.</p>}
    {tournament.status === TOURNAMENT_STATUS.CANCELLED && <p className="tournament-status"><XCircle size={18} aria-hidden="true" /> {tournament.cancellation_reason === "INACTIVITY" ? "Campeonato encerrado por inatividade." : "Campeonato cancelado pelo organizador."}</p>}
    <TournamentOptions canCancel={canCancel} mine={mine} status={tournament.status} busy={busy} onCancel={onCancel} onLeave={onLeave} />
    {notice && <p className="setup-notice" role="status">{notice}</p>}<button type="button" className="tournament-back" onClick={onBack}>Voltar ao hub</button>
  </section>;
}
