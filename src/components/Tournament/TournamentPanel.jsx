"use client";

import { Crown, LinkSimple, Play, Trophy, Users, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { ROUND, TOURNAMENT_CONFIG, TOURNAMENT_STATUS } from "@/lib/tournament/config";

const playerName = (tournament, id) => tournament?.tournament_players?.find((player) => player.player_id === id)?.display_name || "Aguardando...";
const roundLabel = (round) => round === ROUND.FINAL ? "FINAL" : "SEMIFINAL";

const matchStatus = (match) => match?.status === "FINISHED" ? "FINALIZADA" : match?.status === "PLAYING" ? "EM BATALHA" : match ? "PRONTA" : "AGUARDANDO";

function PlayerNode({ player, playerId, matches }) {
  const eliminated = player?.status === "ELIMINATED";
  const winner = matches.some((match) => match.winner_id === player?.player_id);
  return <article className={`tree-player ${player?.player_id === playerId ? "is-local" : ""} ${eliminated ? "is-eliminated" : ""} ${winner ? "is-winner" : ""}`}>
    <span className="tree-player-initial" aria-hidden="true">{player?.display_name?.slice(0, 1)?.toUpperCase() || "?"}</span>
    <strong title={player?.display_name}>{player?.display_name || "Aguardando..."}</strong>
    {player?.player_id === playerId && <small>VOCÊ</small>}
    {player?.status === "CHAMPION" && <small>CAMPEÃO</small>}
    {eliminated && <small>ELIMINADO</small>}
  </article>;
}

function TreeMatch({ tournament, match, playerId, onEnter, final = false }) {
  const mine = match && [match.player1_id, match.player2_id].includes(playerId);
  const finished = match?.status === "FINISHED";
  const playerOneWon = match?.winner_id === match?.player1_id;
  const playerTwoWon = match?.winner_id === match?.player2_id;
  return <article className={`tree-match ${final ? "is-final" : ""} ${finished ? "is-finished" : ""} ${mine && !finished ? "is-current" : ""}`}>
    <div className="tree-match-heading"><span>{final ? "FINAL" : roundLabel(match?.round)}</span><small>{matchStatus(match)}</small></div>
    {match ? <div className="tree-match-players"><strong className={playerOneWon ? "is-winner" : ""} title={playerName(tournament, match.player1_id)}>{playerName(tournament, match.player1_id)} {playerOneWon && <Crown size={14} weight="fill" aria-label="Vencedor" />}</strong><b>VS</b><strong className={playerTwoWon ? "is-winner" : ""} title={playerName(tournament, match.player2_id)}>{playerName(tournament, match.player2_id)} {playerTwoWon && <Crown size={14} weight="fill" aria-label="Vencedor" />}</strong></div> : <p className="tree-pending">Aguardando os vencedores...</p>}
    <footer>{final ? <><Trophy size={15} weight="fill" aria-hidden="true" /> +{TOURNAMENT_CONFIG.rewards.final}</> : <><Trophy size={15} weight="fill" aria-hidden="true" /> +{TOURNAMENT_CONFIG.rewards.semifinal}</>}</footer>
    {mine && !finished && <button type="button" onClick={() => onEnter(match)}><Play size={17} weight="fill" aria-hidden="true" /> {final ? "Preparar para a final" : "Entrar na batalha"}</button>}
  </article>;
}

function TournamentBracket({ tournament, playerId, onEnterMatch }) {
  const matches = tournament.tournament_matches || [];
  const semis = matches.filter((match) => match.round === ROUND.SEMIFINAL).sort((a, b) => a.round_index - b.round_index);
  const final = matches.find((match) => match.round === ROUND.FINAL);
  const champion = tournament.tournament_players?.find((player) => player.status === "CHAMPION");
  const players = semis.length ? semis.flatMap((match) => [match.player1_id, match.player2_id].map((id) => tournament.tournament_players.find((player) => player.player_id === id))) : tournament.tournament_players || [];
  return <section className="tournament-tree" aria-label="Chave do campeonato">
    <div className={`tree-champion ${champion ? "has-champion" : ""}`}><Crown size={champion ? 34 : 26} weight="fill" aria-hidden="true" /><span>CAMPEÃO</span><strong>{champion?.display_name || "Aguardando a final"}</strong>{champion && <small>Semifinal +{TOURNAMENT_CONFIG.rewards.semifinal} · Final +{TOURNAMENT_CONFIG.rewards.final}</small>}</div>
    <div className={`tree-final-link ${final?.winner_id ? "is-complete" : ""}`} aria-hidden="true" />
    <div className="tree-final-wrap"><TreeMatch tournament={tournament} match={final} playerId={playerId} onEnter={onEnterMatch} final /></div>
    <div className="tree-final-connectors" aria-hidden="true"><i className={semis[0]?.winner_id ? "is-complete" : ""} /><i className={semis[1]?.winner_id ? "is-complete" : ""} /></div>
    <div className="tree-semis">{[0, 1].map((index) => <div key={index} className={`tree-semi-branch ${semis[index]?.winner_id ? "has-winner" : ""}`}><TreeMatch tournament={tournament} match={semis[index]} playerId={playerId} onEnter={onEnterMatch} /><div className="tree-player-connectors" aria-hidden="true"><i className={semis[index]?.winner_id === semis[index]?.player1_id ? "is-complete" : ""} /><i className={semis[index]?.winner_id === semis[index]?.player2_id ? "is-complete" : ""} /></div><div className="tree-player-pair">{[players[index * 2], players[index * 2 + 1]].map((player, playerIndex) => <PlayerNode key={player?.player_id || playerIndex} player={player} playerId={playerId} matches={matches} />)}</div></div>)}</div>
  </section>;
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

  const players = tournament.tournament_players || [];
  const isOrganizer = tournament.created_by_player_id === profile.playerId; const mine = players.find((player) => player.player_id === profile.playerId);
  const champion = players.find((player) => player.status === "CHAMPION");
  return <section className="battle-panel tournament-panel tournament-lobby">
    <div className="tournament-heading"><div><span className="eyebrow">CAMPEONATO</span><h2>{tournament.code}</h2></div><div className="tournament-meta"><span className="tournament-status-badge">{tournament.status === TOURNAMENT_STATUS.SEMIFINALS ? "SEMIFINAIS" : tournament.status === TOURNAMENT_STATUS.FINAL ? "FINAL" : tournament.status === TOURNAMENT_STATUS.FINISHED ? "FINALIZADO" : tournament.status === TOURNAMENT_STATUS.CANCELLED ? "CANCELADO" : "AGUARDANDO"}</span><span className="tournament-count"><Users size={18} weight="fill" aria-hidden="true" /> {players.length}/4</span></div></div>
    {tournament.status === TOURNAMENT_STATUS.LOBBY && <><h3>{isOrganizer ? players.length === 4 ? "Pronto para iniciar" : "Aguardando jogadores" : "Aguardando o campeonato começar"}</h3><ul className="tournament-players">{[1, 2, 3, 4].map((slot) => <li key={slot}>{players.find((player) => player.slot === slot)?.display_name || "Aguardando jogador..."}</li>)}</ul>{isOrganizer && (confirmingStart ? <div className="tournament-confirm"><p>Iniciar bloqueia os 4 participantes e cria a chave.</p><button type="button" className="tournament-primary" disabled={busy} onClick={onStart}>{busy ? "Iniciando..." : "Confirmar início"}</button><button type="button" className="tournament-back" onClick={() => setConfirmingStart(false)}>Voltar</button></div> : <button type="button" className="tournament-primary" disabled={players.length !== 4 || busy} onClick={() => setConfirmingStart(true)}>Iniciar campeonato</button>)}{!isOrganizer && <p className="setup-notice">Aguardando quem criou iniciar o campeonato.</p>}</>}
    {[TOURNAMENT_STATUS.SEMIFINALS, TOURNAMENT_STATUS.FINAL, TOURNAMENT_STATUS.FINISHED].includes(tournament.status) && <><TournamentBracket tournament={tournament} playerId={profile.playerId} onEnterMatch={onEnterMatch} />{mine?.status === "ELIMINATED" && <p className="tournament-status"><WarningCircle size={18} aria-hidden="true" /> Eliminado. Acompanhe o desfecho da chave.</p>}{champion && <p className="tournament-champion"><Trophy size={28} weight="fill" aria-hidden="true" /> Campeão: {champion.display_name}</p>}</>}
    {tournament.status === TOURNAMENT_STATUS.CANCELLED && <p className="tournament-status"><XCircle size={18} aria-hidden="true" /> Campeonato cancelado pelo organizador.</p>}
    {isOrganizer && tournament.status === TOURNAMENT_STATUS.LOBBY && <div className="tournament-cancel">{confirmingCancel ? <><p>Cancelar encerra este campeonato para todos e não pode ser desfeito.</p><button type="button" className="tournament-cancel-confirm" disabled={busy} onClick={onCancel}>{busy ? "Cancelando..." : "Confirmar cancelamento"}</button><button type="button" className="tournament-back" onClick={() => setConfirmingCancel(false)}>Manter campeonato</button></> : <button type="button" className="tournament-cancel-button" disabled={busy} onClick={() => setConfirmingCancel(true)}><XCircle size={18} aria-hidden="true" /> Cancelar campeonato</button>}</div>}
    {!isOrganizer && mine && tournament.status === TOURNAMENT_STATUS.LOBBY && <div className="tournament-cancel">{confirmingLeave ? <><p>Sair libera sua vaga neste lobby. Você poderá entrar de novo se houver espaço.</p><button type="button" className="tournament-cancel-confirm" disabled={busy} onClick={onLeave}>{busy ? "Saindo..." : "Confirmar saída"}</button><button type="button" className="tournament-back" onClick={() => setConfirmingLeave(false)}>Manter participação</button></> : <button type="button" className="tournament-cancel-button" disabled={busy} onClick={() => setConfirmingLeave(true)}><XCircle size={18} aria-hidden="true" /> Sair do campeonato</button>}</div>}
    {process.env.NODE_ENV !== "production" && <details className="tournament-debug"><summary>Diagnóstico de desenvolvimento</summary><small>Nome local: {name}</small><small>playerId local: {profile.playerId}</small><small>Armazenamento: IndexedDB / PokedExploreDB / player</small><small>Participantes no banco: {players.length}</small><small>Já participa: {mine ? "sim" : "não"}</small><small>Participante correspondente: {mine ? `${mine.display_name} (${mine.player_id})` : "nenhum"}</small><ol>{players.map((item) => <li key={item.player_id}>slot {item.slot}: {item.display_name} ({item.player_id})</li>)}</ol></details>}
    {notice && <p className="setup-notice" role="status">{notice}</p>}<button type="button" className="tournament-back" onClick={onBack}>Voltar ao hub</button>
  </section>;
}
