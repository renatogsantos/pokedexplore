"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Copy, GameController, LinkSimple, Question, Users } from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { webStore } from "@/helpers/webStore";
import TeamSelector from "@/components/Battle/TeamSelector";
import BattleArena from "@/components/Battle/BattleArena";
import { CPU_TEAM, toBattlePokemon } from "@/lib/battle/pokemon";
import { createBattleState, resolveAction } from "@/lib/battle/engine";
import { BATTLE_EVENTS, createBattleRoom, hasRealtimeConfig } from "@/lib/battle/realtime";
import { playBattleSound } from "@/lib/battle/sound";
import "./style.scss";

const makeCode = () => `PKDX-${Math.floor(1000 + Math.random() * 9000)}`;
const makePlayer = (name) => ({ id: crypto.randomUUID(), name: name.trim() || "Treinador" });

export default function BattlePage() {
  const params = useSearchParams();
  const realtime = useRef(null); const cpuTimer = useRef(null); const introTimer = useRef(null);
  const [screen, setScreen] = useState("mode");
  const [collection, setCollection] = useState([]); const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState(null); const [name, setName] = useState("Treinador");
  const [roomCode, setRoomCode] = useState(""); const [joinCode, setJoinCode] = useState(params.get("room")?.toUpperCase() || "");
  const [player, setPlayer] = useState(null); const [role, setRole] = useState("host"); const [presence, setPresence] = useState({});
  const [remoteTeam, setRemoteTeam] = useState(null); const [battle, setBattle] = useState(null); const [notice, setNotice] = useState("");
  const [readySent, setReadySent] = useState(false);
  const [connection, setConnection] = useState("CONNECTING");

  useEffect(() => { webStore.getData("Pokedex").then(setCollection); return () => { realtime.current?.leave(); clearTimeout(cpuTimer.current); clearTimeout(introTimer.current); }; }, []);

  const broadcast = useCallback((type, payload) => realtime.current?.send({ type, payload }).catch((error) => setNotice(error.message)), []);
  const startState = useCallback((hostTeam, guestTeam, host, guest) => {
    const next = createBattleState({ ...host, team: hostTeam.map(toBattlePokemon) }, { ...guest, team: guestTeam.map(toBattlePokemon) });
    next.status = "countdown"; next.log = "3 · 2 · 1 · BATALHA!";
    setBattle(next); setScreen("battle"); broadcast(BATTLE_EVENTS.START, next);
    clearTimeout(introTimer.current);
    introTimer.current = setTimeout(() => { const playing = { ...next, status: "playing", log: `SUA VEZ, ${host.name.toUpperCase()}!` }; setBattle(playing); broadcast(BATTLE_EVENTS.STATE, playing); }, 1650);
  }, [broadcast]);

  const connectRoom = useCallback((code, currentPlayer, currentRole) => {
    try {
      realtime.current?.leave();
      realtime.current = createBattleRoom(code, currentPlayer, {
        onPresence: (nextPresence) => {
          setPresence(nextPresence);
          const players = Object.values(nextPresence).flat();
          const peer = players.find((item) => item.id !== currentPlayer.id);
          if (peer?.ready && Array.isArray(peer.team)) {
            setRemoteTeam({ player: { id: peer.id, name: peer.name }, team: peer.team });
            setNotice("ADVERSÁRIO PRONTO! Preparando batalha...");
          }
        },
        onStatus: (status) => {
          const state = status === "SUBSCRIBED" ? "CONNECTED" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "ERROR" : status === "CLOSED" ? "DISCONNECTED" : "CONNECTING";
          setConnection(state);
          setNotice(state === "CONNECTED" ? "Conectado à sala. Selecione sua equipe." : state === "ERROR" ? "Não foi possível conectar ao Realtime." : "Conectando à sala...");
        },
        onEvent: ({ type, payload }) => {
          if (type === BATTLE_EVENTS.TEAM && payload?.player?.id !== currentPlayer.id) { setRemoteTeam(payload); setNotice("ADVERSÁRIO PRONTO! Preparando batalha..."); }
          if (type === BATTLE_EVENTS.START || type === BATTLE_EVENTS.STATE) { setBattle(payload); setScreen("battle"); setNotice("BATALHA INICIADA!"); }
          if (type === BATTLE_EVENTS.ACTION && currentRole === "host") setBattle((previous) => { if (!previous) return previous; const next = resolveAction(previous, "guest", payload); broadcast(BATTLE_EVENTS.STATE, next); return next; });
          if (type === BATTLE_EVENTS.REMATCH) setNotice("Seu adversário quer uma revanche. Escolha sua equipe novamente.");
        },
      });
    } catch { setNotice("Não foi possível conectar à sala."); }
  }, [broadcast]);

  useEffect(() => {
    if (mode !== "friend" || role !== "host" || !readySent || selected.length !== 3 || !remoteTeam || !player || battle) return;
    startState(selected, remoteTeam.team, player, remoteTeam.player);
  }, [mode, role, readySent, selected, remoteTeam, player, battle, startState]);

  useEffect(() => {
    if (mode !== "cpu" || !battle || battle.turn !== "guest" || battle.status !== "playing") return;
    clearTimeout(cpuTimer.current);
    cpuTimer.current = setTimeout(() => setBattle((current) => {
      const active = current?.guest?.team[current.guest.active];
      const shouldHeal = active && active.hp > 0 && active.hp / active.maxHp <= .35 && current.guest.potionsRemaining > 0;
      const useSpecial = active?.specialAttackUsesRemaining > 0 && Math.random() > .48;
      return resolveAction(current, "guest", shouldHeal ? { type: "potion", targetPokemonId: active.id } : { type: "attack", moveId: useSpecial ? "type-strike" : "strike" });
    }), 850);
    return () => clearTimeout(cpuTimer.current);
  }, [mode, battle]);

  function chooseMode(nextMode) { setMode(nextMode); setSelected([]); setBattle(null); setReadySent(false); setScreen(nextMode === "cpu" ? "team" : "friend"); }
  function togglePokemon(pokemon) { playBattleSound("select-pokemon", 0.4); setSelected((current) => current.some((item) => item.id === pokemon.id) ? current.filter((item) => item.id !== pokemon.id) : current.length < 3 ? [...current, pokemon] : current); }
  function readyTeam() {
    if (mode === "cpu") { const local = makePlayer(name); setPlayer(local); startState(selected, CPU_TEAM, local, { id: "cpu", name: "CPU" }); return; }
    if (!realtime.current?.isConnected()) { setNotice("Ainda conectando à sala. Aguarde antes de confirmar."); return; }
    const payload = { player, team: selected.map(toBattlePokemon) };
    realtime.current.updatePresence({ ready: true, team: payload.team }).then(() => {
      broadcast(BATTLE_EVENTS.TEAM, payload); setReadySent(true); setNotice("PRONTO! Aguardando adversário...");
    }).catch((error) => setNotice(error.message));
  }
  function createRoom() { if (!hasRealtimeConfig()) { setNotice("Configure as variáveis do Supabase para jogar contra um amigo."); return; } const currentPlayer = makePlayer(name); const code = makeCode(); setPlayer(currentPlayer); setRole("host"); setRoomCode(code); setScreen("team"); connectRoom(code, currentPlayer, "host"); }
  function joinRoom() { if (!hasRealtimeConfig()) { setNotice("Configure as variáveis do Supabase para jogar contra um amigo."); return; } if (!joinCode.trim()) { setNotice("Digite o código da sala."); return; } const currentPlayer = makePlayer(name); const code = joinCode.trim().toUpperCase(); setPlayer(currentPlayer); setRole("guest"); setRoomCode(code); setScreen("team"); connectRoom(code, currentPlayer, "guest"); }
  function sendAction(action) { if (mode === "cpu") setBattle((current) => resolveAction(current, "host", action)); else if (role === "host") setBattle((current) => { const next = resolveAction(current, "host", action); broadcast(BATTLE_EVENTS.STATE, next); return next; }); else broadcast(BATTLE_EVENTS.ACTION, action); }
  function rematch() { if (mode === "friend") broadcast(BATTLE_EVENTS.REMATCH, {}); setBattle(null); setSelected([]); setRemoteTeam(null); setReadySent(false); setScreen("team"); }
  async function shareRoom() { const url = `${window.location.origin}/batalha?room=${roomCode}`; try { if (navigator.share) await navigator.share({ title: "Batalha PokédExplore", text: `Entre na sala ${roomCode}`, url }); else await navigator.clipboard.writeText(url); setNotice("Convite copiado/compartilhado!"); } catch {} }

  return <main className="battle-page"><div className="battle-shell"><header className="battle-header"><Link href="/#pokedex" className="battle-back"><ArrowLeft size={20} /> Pokédex</Link><div className="battle-title"><span>ARENA</span><h1>Batalha Pokémon</h1></div><span className="battle-header-actions"><Link href="/como-jogar" className="battle-help"><Question size={18} weight="bold" /><span>Como jogar</span></Link><span className="battle-round">3 × 3</span></span></header>{screen === "mode" && <ModeScreen onChoose={chooseMode} />}{screen === "friend" && <FriendScreen name={name} setName={setName} joinCode={joinCode} setJoinCode={setJoinCode} onCreate={createRoom} onJoin={joinRoom} notice={notice} />}{screen === "team" && <><RoomStatus mode={mode} roomCode={roomCode} player={player} presence={presence} notice={notice} connection={connection} ready={readySent} onShare={shareRoom} /> <TeamSelector collection={collection} selected={selected} onToggle={togglePokemon} onReady={readyTeam} waiting={readySent} canReady={mode === "cpu" || connection === "CONNECTED"} /></>}{screen === "battle" && battle && <BattleArena state={battle} role={role} onAction={sendAction} onRematch={rematch} />}</div></main>;
}

function ModeScreen({ onChoose }) { return <section className="battle-panel mode-panel"><span className="eyebrow">ESCOLHA COMO JOGAR</span><h2>Pronto para a arena?</h2><p>Monte sua equipe capturada e desafie a CPU ou um amigo.</p><div className="mode-options"><button type="button" onClick={() => onChoose("friend")}><Users size={28} weight="fill" /><strong>Contra um amigo</strong><small>Crie ou entre em uma sala</small></button><button type="button" onClick={() => onChoose("cpu")}><GameController size={28} weight="fill" /><strong>Contra a CPU</strong><small>Treine sua equipe</small></button></div></section>; }
function FriendScreen({ name, setName, joinCode, setJoinCode, onCreate, onJoin, notice }) { return <section className="battle-panel friend-panel"><span className="eyebrow">BATALHA ONLINE</span><h2>Entre com seu treinador</h2><label>Seu nome<input maxLength="18" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Renato" /></label><div className="friend-actions"><button type="button" onClick={onCreate}><LinkSimple size={24} /> Criar sala</button><div><label>Código da sala<input value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="PKDX-1234" /></label><button type="button" onClick={onJoin}>Entrar na sala</button></div></div>{notice && <p className="setup-notice" role="status">{notice}</p>}</section>; }
function RoomStatus({ mode, roomCode, player, presence, notice, connection, ready, onShare }) { if (mode === "cpu") return <div className="room-status"><span>Modo treino</span><strong>CPU conectada</strong></div>; const connected = Object.keys(presence).length; return <div className="room-status"><div><span>SALA</span><strong>{roomCode}</strong></div><div><small>Conexão: {connection === "CONNECTED" ? "conectada ✓" : connection.toLowerCase()}</small><small>Você: {ready ? "PRONTO ✓" : `${player?.name} selecionando...`}</small><small>Adversário: {connected > 1 ? "conectado ✓" : "aguardando..."}</small></div><button type="button" onClick={onShare}><Copy size={18} /> Compartilhar</button>{notice && <em>{notice}</em>}</div>; }
