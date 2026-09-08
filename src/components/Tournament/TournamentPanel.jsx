"use client";

import { Crown, LinkSimple, Play, Trophy, Users, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { ROUND, TOURNAMENT_CONFIG, TOURNAMENT_STATUS } from "@/lib/tournament/config";

const playerName = (tournament, id) => tournament?.tournament_players?.find((player) => player.player_id === id)?.display_name || "Aguardando...";
const roundLabel = (round) => round === ROUND.FINAL ? "FINAL" : "SEMIFINAL";

function MatchCard({ tournament, match, playerId, onEnter }) {
  const mine = match && [match.player1_id, match.player2_id].includes(playerId);
  const finished = match?.status === "FINISHED";
  return <article className={`tournament-match ${finished ? "is-finished" : ""}`}>
    <span>{roundLabel(match?.round)}</span>
    <strong>{playerName(tournament, match?.player1_id)} {match?.winner_id === match?.player1_id && <Crown size={15} weight="fill" aria-label="Vencedor" />}</strong>
    <b>VS</b>
    <strong>{playerName(tournament, match?.player2_id)} {match?.winner_id === match?.player2_id && <Crown size={15} weight="fill" aria-label="Vencedor" />}</strong>
    <small>{finished ? "Finalizado" : match?.status === "PLAYING" ? "Em batalha" : "Pronta para jogar"}</small>
    {mine && !finished && <button type="button" onClick={() => onEnter(match)}><Play size={18} weight="fill" aria-hidden="true" /> {match?.round === ROUND.FINAL ? "Preparar para a final" : "Entrar na batalha"}</button>}
  </article>;
}

export default function TournamentPanel({ tournament, profile, name, setName, code, setCode, notice, busy, onCreate, onJoin, onResetIdentity, onStart, onCancel, onLeave, onEnterMatch, onBack }) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [confirmingStart, setConfirmingStart] = useState(false);
  if (!tournament) return <section className="battle-panel friend-panel tournament-panel">
    <span className="eyebrow">CAMPEONATO ONLINE</span><h2>Entre com seu treinador</h2>
    <p>4 jogadores · 2 semifinais · 1 final</p>
    <div className="tournament-rewards"><span><Trophy size={20} weight="fill" aria-hidden="true" /> Semifinal <b>+{TOURNAMENT_CONFIG.rewards.semifinal}</b></span><span><Crown size={20} weight="fill" aria-hidden="true" /> Final <b>+{TOURNAMENT_CONFIG.rewards.final}</b></span></div>
    <label>Seu nome<input maxLength="18" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Renato" /></label>
    <div className="friend-actions tournament-entry"><button type="button" onClick={onCreate} disabled={busy}><LinkSimple size={24} aria-hidden="true" /> Criar campeonato</button><div><label>Código do campeonato<span className="room-code-input"><b aria-hidden="true">PKC-</b><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" pattern="[0-9]*" maxLength="4" placeholder="1234" aria-label="Quatro números do código do campeonato" /></span><small>Digite somente os 4 números.</small></label><button type="button" onClick={onJoin} disabled={busy}>Entrar</button></div></div>
    {process.env.NODE_ENV !== "production" && <details className="tournament-debug"><summary>Diagnóstico de desenvolvimento</summary><small>Nome local: {name}</small><small>playerId local: {profile.playerId}</small><small>Armazenamento: IndexedDB / PokedExploreDB / player</small><button type="button" onClick={onResetIdentity}>Gerar nova identidade local</button></details>}
    {notice && <p className="setup-notice" role="status">{notice}</p>}<button type="button" className="tournament-back" onClick={onBack}>Voltar</button>
  </section>;

  const players = tournament.tournament_players || []; const matches = tournament.tournament_matches || [];
  const semis = matches.filter((match) => match.round === ROUND.SEMIFINAL); const final = matches.find((match) => match.round === ROUND.FINAL);
  const isOrganizer = tournament.created_by_player_id === profile.playerId; const mine = players.find((player) => player.player_id === profile.playerId);
  const champion = players.find((player) => player.status === "CHAMPION");
  return <section className="battle-panel tournament-panel tournament-lobby">
    <div className="tournament-heading"><div><span className="eyebrow">CAMPEONATO</span><h2>{tournament.code}</h2></div><span className="tournament-count"><Users size={18} weight="fill" aria-hidden="true" /> {players.length}/4</span></div>
    {tournament.status === TOURNAMENT_STATUS.LOBBY && <><h3>{isOrganizer ? players.length === 4 ? "Pronto para iniciar" : "Aguardando jogadores" : "Aguardando o campeonato começar"}</h3><ul className="tournament-players">{[1, 2, 3, 4].map((slot) => <li key={slot}>{players.find((player) => player.slot === slot)?.display_name || "Aguardando jogador..."}</li>)}</ul>{isOrganizer && (confirmingStart ? <div className="tournament-confirm"><p>Iniciar bloqueia os 4 participantes e cria a chave.</p><button type="button" className="tournament-primary" disabled={busy} onClick={onStart}>{busy ? "Iniciando..." : "Confirmar início"}</button><button type="button" className="tournament-back" onClick={() => setConfirmingStart(false)}>Voltar</button></div> : <button type="button" className="tournament-primary" disabled={players.length !== 4 || busy} onClick={() => setConfirmingStart(true)}>Iniciar campeonato</button>)}{!isOrganizer && <p className="setup-notice">Aguardando quem criou iniciar o campeonato.</p>}</>}
    {[TOURNAMENT_STATUS.SEMIFINALS, TOURNAMENT_STATUS.FINAL, TOURNAMENT_STATUS.FINISHED].includes(tournament.status) && <><div className="tournament-bracket"><section><h3>Semifinais</h3>{semis.map((match) => <MatchCard key={match.id} tournament={tournament} match={match} playerId={profile.playerId} onEnter={onEnterMatch} />)}</section><section><h3>Final</h3>{final ? <MatchCard tournament={tournament} match={final} playerId={profile.playerId} onEnter={onEnterMatch} /> : <article className="tournament-match"><strong>Aguardando finalistas...</strong></article>}</section></div>{mine?.status === "ELIMINATED" && <p className="tournament-status"><WarningCircle size={18} aria-hidden="true" /> Eliminado. Acompanhe o desfecho da chave.</p>}{champion && <p className="tournament-champion"><Trophy size={28} weight="fill" aria-hidden="true" /> Campeão: {champion.display_name}</p>}</>}
    {tournament.status === TOURNAMENT_STATUS.CANCELLED && <p className="tournament-status"><XCircle size={18} aria-hidden="true" /> Campeonato cancelado pelo organizador.</p>}
    {isOrganizer && tournament.status === TOURNAMENT_STATUS.LOBBY && <div className="tournament-cancel">{confirmingCancel ? <><p>Cancelar encerra este campeonato para todos e não pode ser desfeito.</p><button type="button" className="tournament-cancel-confirm" disabled={busy} onClick={onCancel}>{busy ? "Cancelando..." : "Confirmar cancelamento"}</button><button type="button" className="tournament-back" onClick={() => setConfirmingCancel(false)}>Manter campeonato</button></> : <button type="button" className="tournament-cancel-button" disabled={busy} onClick={() => setConfirmingCancel(true)}><XCircle size={18} aria-hidden="true" /> Cancelar campeonato</button>}</div>}
    {!isOrganizer && mine && tournament.status === TOURNAMENT_STATUS.LOBBY && <div className="tournament-cancel">{confirmingLeave ? <><p>Sair libera sua vaga neste lobby. Você poderá entrar de novo se houver espaço.</p><button type="button" className="tournament-cancel-confirm" disabled={busy} onClick={onLeave}>{busy ? "Saindo..." : "Confirmar saída"}</button><button type="button" className="tournament-back" onClick={() => setConfirmingLeave(false)}>Manter participação</button></> : <button type="button" className="tournament-cancel-button" disabled={busy} onClick={() => setConfirmingLeave(true)}><XCircle size={18} aria-hidden="true" /> Sair do campeonato</button>}</div>}
    {process.env.NODE_ENV !== "production" && <details className="tournament-debug"><summary>Diagnóstico de desenvolvimento</summary><small>Nome local: {name}</small><small>playerId local: {profile.playerId}</small><small>Armazenamento: IndexedDB / PokedExploreDB / player</small><small>Participantes no banco: {players.length}</small><small>Já participa: {mine ? "sim" : "não"}</small><small>Participante correspondente: {mine ? `${mine.display_name} (${mine.player_id})` : "nenhum"}</small><ol>{players.map((item) => <li key={item.player_id}>slot {item.slot}: {item.display_name} ({item.player_id})</li>)}</ol></details>}
    {notice && <p className="setup-notice" role="status">{notice}</p>}<button type="button" className="tournament-back" onClick={onBack}>Voltar ao hub</button>
  </section>;
}
