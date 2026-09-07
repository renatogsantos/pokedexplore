"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  GameController,
  LinkSimple,
  Question,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDispatch } from "react-redux";
import { webStore } from "@/helpers/webStore";
import TeamSelector from "@/components/Battle/TeamSelector";
import BattleArena from "@/components/Battle/BattleArena";
import { CPU_ROSTER, CPU_TEAM, toBattlePokemon } from "@/lib/battle/pokemon";
import { calculateDamage, createBattleState, getPokemonMatchup, resolveAction } from "@/lib/battle/engine";
import {
  BATTLE_EVENTS,
  createBattleRoom,
  hasRealtimeConfig,
} from "@/lib/battle/realtime";
import { playBattleSound } from "@/lib/battle/sound";
import { calculateBattleRewards } from "@/lib/battle/rewards";
import { actCoins } from "@/redux/economy";
import CoinBalance from "@/components/CoinBalance";
import { celebrateBattleVictory } from "@/lib/celebration";
import { getJourneyNode } from "@/lib/journey";
import "./style.scss";

const makeCode = () => `PKDX-${Math.floor(1000 + Math.random() * 9000)}`;
const ROOM_PREFIX = "PKDX-";
const getRoomDigits = (value = "") =>
  String(value).replace(/\D/g, "").slice(0, 4);
const makePlayer = (name) => ({
  id: crypto.randomUUID(),
  name: name.trim() || "Treinador",
});
const makeMatchId = () => crypto.randomUUID();

export default function BattlePage() {
  const dispatch = useDispatch();
  const params = useSearchParams();
  const journeyNode = getJourneyNode(params.get("journey"));
  const realtime = useRef(null);
  const cpuTimer = useRef(null);
  const introTimer = useRef(null);
  const [screen, setScreen] = useState("mode");
  const [collection, setCollection] = useState([]);
  const [inventory, setInventory] = useState({});
  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState(null);
  const [cpuDifficulty, setCpuDifficulty] = useState("normal");
  const [name, setName] = useState("Treinador");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState(getRoomDigits(params.get("room")));
  const [player, setPlayer] = useState(null);
  const [role, setRole] = useState("host");
  const [presence, setPresence] = useState({});
  const [remoteTeam, setRemoteTeam] = useState(null);
  const [battle, setBattle] = useState(null);
  const [notice, setNotice] = useState("");
  const [readySent, setReadySent] = useState(false);
  const [connection, setConnection] = useState("CONNECTING");

  useEffect(() => {
    webStore.getData("Pokedex").then(setCollection);
    webStore.getEconomy().then((economy) => setInventory(economy.inventory || {}));
    webStore.getTrainerName().then((savedName) => setName((currentName) => currentName === "Treinador" ? savedName : currentName));
    return () => {
      realtime.current?.leave();
      clearTimeout(cpuTimer.current);
      clearTimeout(introTimer.current);
    };
  }, []);

  const broadcast = useCallback(
    (type, payload) =>
      realtime.current
        ?.send({ type, payload })
        .catch((error) => setNotice(error.message)),
    [],
  );
  const persistBattleConsumables = useCallback((state, localRole) => {
    const effect = state?.effect;
    if (!effect || !state?.matchId) return;
    const actionItem = effect.kind === "potion" ? "potion" : effect.kind === "item" ? effect.itemId : null;
    if (actionItem && effect.actor === localRole)
      void webStore.consumeInventory({ [actionItem]: 1 }, `${state.matchId}:${state.revision}:bag:${localRole}:${actionItem}`).then((result) => {
        if (result.ok) setInventory(result.economy.inventory || {});
      });
    const berry = effect.berry;
    if (berry && berry.owner === localRole)
      void webStore.consumeHeldItem(berry.targetPokemonId, berry.berry, `${state.matchId}:${state.revision}:held:${localRole}:${berry.targetPokemonId}:${berry.berry}`).then((result) => {
        if (result.ok) setInventory(result.economy.inventory || {});
      });
  }, []);
  const startState = useCallback(
    (hostTeam, guestTeam, host, guest) => {
      const next = createBattleState(
        { ...host, inventory: { potion: inventory.potion || 0, "full-heal": inventory["full-heal"] || 0 }, team: hostTeam.map(toBattlePokemon) },
        { ...guest, team: guestTeam.map(toBattlePokemon) },
      );
      next.matchId = makeMatchId();
      next.status = "countdown";
      next.log = "3 · 2 · 1 · BATALHA!";
      setBattle(next);
      setScreen("battle");
      broadcast(BATTLE_EVENTS.START, next);
      clearTimeout(introTimer.current);
      introTimer.current = setTimeout(() => {
        const playing = {
          ...next,
          status: "playing",
          performance: { ...next.performance, startedAt: Date.now() },
          log: `SUA VEZ, ${host.name.toUpperCase()}!`,
        };
        setBattle(playing);
        broadcast(BATTLE_EVENTS.STATE, playing);
      }, 1650);
    },
    [broadcast, inventory],
  );
  const awardVictory = useCallback(
    async (matchId, amount) => {
      const reward = await webStore.rewardVictory(matchId, amount);
      dispatch(actCoins(reward.coins));
      return reward;
    },
    [dispatch],
  );
  const rewardFinishedBattle = useCallback(
    (previous, next, localRole) => {
      if (previous?.status !== "finished" && next?.status === "finished") {
        const performance = next.performance || {};
        const won = next.winner === localRole;
        void webStore.recordBattleOutcome(next.matchId, {
          won,
          durationMs: performance.endedAt - performance.startedAt,
          usedOnlyOnePokemon: !performance.players?.[localRole]?.hasSwitched,
        }).then((result) => {
          if (result.rewardCoins) dispatch(actCoins(result.coins));
          if (result.unlocked?.length) setNotice("CONQUISTA DESBLOQUEADA: " + result.unlocked.join(", ").toUpperCase() + (result.rewardCoins ? ` +${result.rewardCoins} moedas` : ""));
        });
        if (journeyNode && won) void webStore.completeJourneyNode(journeyNode).then((result) => { if (result.completed) setNotice(journeyNode.badge ? "INSÍGNIA CONQUISTADA: " + journeyNode.badge : "ROTA CONCLUÍDA! +" + journeyNode.reward + " moedas"); });
      }
      if (
        previous?.status !== "finished" &&
        next?.status === "finished" &&
        next.winner === localRole
      ) {
        const performance = next.performance || {};
        const reward = calculateBattleRewards({
          won: true,
          durationMs: performance.endedAt - performance.startedAt,
          usedOnlyOnePokemon: !performance.players?.[localRole]?.hasSwitched,
        });
        celebrateBattleVictory();
        void awardVictory(next.matchId, reward.total);
      }
      return next;
    },
    [awardVictory, journeyNode],
  );

  const connectRoom = useCallback(
    (code, currentPlayer, currentRole) => {
      try {
        realtime.current?.leave();
        realtime.current = createBattleRoom(code, currentPlayer, {
          onPresence: (nextPresence) => {
            setPresence(nextPresence);
            const players = Object.values(nextPresence).flat();
            const peer = players.find((item) => item.id !== currentPlayer.id);
            if (peer?.ready && Array.isArray(peer.team)) {
              setRemoteTeam({
                player: { id: peer.id, name: peer.name },
                team: peer.team,
              });
              setNotice("ADVERSÁRIO PRONTO! Preparando batalha...");
            }
          },
          onStatus: (status) => {
            const state =
              status === "SUBSCRIBED"
                ? "CONNECTED"
                : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
                  ? "ERROR"
                  : status === "CLOSED"
                    ? "DISCONNECTED"
                    : "CONNECTING";
            setConnection(state);
            setNotice(
              state === "CONNECTED"
                ? "Conectado à sala. Selecione sua equipe."
                : state === "ERROR"
                  ? "Não foi possível conectar ao Realtime."
                  : "Conectando à sala...",
            );
          },
          onEvent: ({ type, payload }) => {
            if (
              type === BATTLE_EVENTS.TEAM &&
              payload?.player?.id !== currentPlayer.id
            ) {
              setRemoteTeam(payload);
              setNotice("ADVERSÁRIO PRONTO! Preparando batalha...");
            }
            if (type === BATTLE_EVENTS.START || type === BATTLE_EVENTS.STATE) {
              persistBattleConsumables(payload, currentRole);
              setBattle((previous) =>
                rewardFinishedBattle(previous, payload, currentRole),
              );
              setScreen("battle");
              setNotice("BATALHA INICIADA!");
            }
            if (type === BATTLE_EVENTS.ACTION && currentRole === "host")
              setBattle((previous) => {
                if (!previous) return previous;
                const next = resolveAction(previous, "guest", payload);
                persistBattleConsumables(next, currentRole);
                broadcast(BATTLE_EVENTS.STATE, next);
                return rewardFinishedBattle(previous, next, currentRole);
              });
            if (type === BATTLE_EVENTS.REMATCH)
              setNotice(
                "Seu adversário quer uma revanche. Escolha sua equipe novamente.",
              );
          },
        });
      } catch {
        setNotice("Não foi possível conectar à sala.");
      }
    },
    [broadcast, persistBattleConsumables, rewardFinishedBattle],
  );

  useEffect(() => {
    if (
      mode !== "friend" ||
      role !== "host" ||
      !readySent ||
      selected.length !== 3 ||
      !remoteTeam ||
      !player ||
      battle
    )
      return;
    startState(selected, remoteTeam.team, player, remoteTeam.player);
  }, [mode, role, readySent, selected, remoteTeam, player, battle, startState]);

  useEffect(() => {
    if (
      mode !== "cpu" ||
      !battle ||
      battle.turn !== "guest" ||
      battle.status !== "playing"
    )
      return;
    clearTimeout(cpuTimer.current);
    cpuTimer.current = setTimeout(
      () =>
        setBattle((current) => {
          const active = current?.guest?.team[current.guest.active];
          const shouldHeal =
            active &&
            active.hp > 0 &&
            active.hp / active.maxHp <= 0.35 &&
            current.guest.potionsRemaining > 0;
          const availableMoves = (active?.moves || []).filter((move) => !move.special || active?.specialAttackUsesRemaining > 0);
          const specialMove = availableMoves.find((move) => move.special && active?.specialAttackUsesRemaining > 0);
          const regularMove = availableMoves.find((move) => !move.special) || availableMoves[0];
          const useSpecial = specialMove && Math.random() > 0.48;
          const enemy = current?.host?.team[current.host.active];
          const bestMove = [...availableMoves].sort((a, b) => calculateDamage({ attacker: active, defender: enemy, move: b }).damage - calculateDamage({ attacker: active, defender: enemy, move: a }).damage)[0];
          const reserveIndex = current?.guest?.team.findIndex((pokemon, index) => index !== current.guest.active && pokemon.hp > 0 && getPokemonMatchup(pokemon, enemy) === "advantage");
          const shouldSwitch = cpuDifficulty === "hard" && reserveIndex >= 0 && getPokemonMatchup(active, enemy) === "disadvantage" && active.hp / active.maxHp < .65;
          return rewardFinishedBattle(
            current,
            resolveAction(
              current,
              "guest",
              shouldSwitch
                ? { type: "switch", index: reserveIndex }
                : shouldHeal
                ? { type: "potion", targetPokemonId: active.id }
                : {
                    type: "attack",
                    moveId: (cpuDifficulty === "easy" ? regularMove : cpuDifficulty === "hard" ? bestMove : useSpecial ? specialMove : regularMove)?.id || "strike",
                  },
            ),
            "host",
          );
        }),
      850,
    );
    return () => clearTimeout(cpuTimer.current);
  }, [mode, battle, cpuDifficulty, rewardFinishedBattle]);

  function chooseMode(nextMode, difficulty = "normal") {
    setMode(nextMode);
    setCpuDifficulty(difficulty);
    setSelected([]);
    setBattle(null);
    setReadySent(false);
    setScreen(nextMode === "cpu" ? "team" : "friend");
  }
  function togglePokemon(pokemon) {
    playBattleSound("select-pokemon", 0.4);
    setSelected((current) =>
      current.some((item) => item.id === pokemon.id)
        ? current.filter((item) => item.id !== pokemon.id)
        : current.length < 3
          ? [...current, pokemon]
          : current,
    );
  }
  function readyTeam() {
    if (mode === "cpu") {
      const local = makePlayer(name);
      setPlayer(local);
      const journeyTeam = journeyNode ? journeyNode.team.map((entry) => { const rosterEntry = CPU_ROSTER.find((pokemon) => pokemon.id === (entry.id || entry)) || CPU_TEAM[0]; return { ...rosterEntry, level: entry.level || rosterEntry.level }; }) : CPU_TEAM;
      startState(selected, journeyTeam, local, { id: "cpu", name: journeyNode?.badge ? "Líder do Ginásio" : journeyNode ? journeyNode.title : "CPU" });
      return;
    }
    if (!realtime.current?.isConnected()) {
      setNotice("Ainda conectando à sala. Aguarde antes de confirmar.");
      return;
    }
    const payload = { player, team: selected.map(toBattlePokemon) };
    realtime.current
      .updatePresence({ ready: true, team: payload.team })
      .then(() => {
        broadcast(BATTLE_EVENTS.TEAM, payload);
        setReadySent(true);
        setNotice("PRONTO! Aguardando adversário...");
      })
      .catch((error) => setNotice(error.message));
  }
  function createRoom() {
    if (!hasRealtimeConfig()) {
      setNotice(
        "Configure as variáveis do Supabase para jogar contra um amigo.",
      );
      return;
    }
    const currentPlayer = makePlayer(name);
    setName(currentPlayer.name);
    void webStore.setTrainerName(currentPlayer.name);
    const code = makeCode();
    setPlayer(currentPlayer);
    setRole("host");
    setRoomCode(code);
    setScreen("team");
    connectRoom(code, currentPlayer, "host");
  }
  function joinRoom() {
    if (!hasRealtimeConfig()) {
      setNotice(
        "Configure as variáveis do Supabase para jogar contra um amigo.",
      );
      return;
    }
    if (joinCode.length !== 4) {
      setNotice("Digite os 4 números do código da sala.");
      return;
    }
    const currentPlayer = makePlayer(name);
    setName(currentPlayer.name);
    void webStore.setTrainerName(currentPlayer.name);
    const code = `${ROOM_PREFIX}${joinCode}`;
    setPlayer(currentPlayer);
    setRole("guest");
    setRoomCode(code);
    setScreen("team");
    connectRoom(code, currentPlayer, "guest");
  }
  function sendAction(action) {
    const resolveAndPersist = (current, actor) => {
      const next = resolveAction(current, actor, action);
      persistBattleConsumables(next, role);
      return next;
    };
    if (mode === "cpu")
      setBattle((current) =>
        rewardFinishedBattle(
          current,
          resolveAndPersist(current, "host"),
          "host",
        ),
      );
    else if (role === "host")
      setBattle((current) => {
        const next = resolveAndPersist(current, "host");
        broadcast(BATTLE_EVENTS.STATE, next);
        return rewardFinishedBattle(current, next, "host");
      });
    else broadcast(BATTLE_EVENTS.ACTION, action);
  }
  function rematch() {
    if (mode === "friend") broadcast(BATTLE_EVENTS.REMATCH, {});
    setBattle(null);
    setSelected([]);
    setRemoteTeam(null);
    setReadySent(false);
    setScreen("team");
  }
  async function shareRoom() {
    const url = `${window.location.origin}/batalha?room=${roomCode}`;
    try {
      if (navigator.share)
        await navigator.share({
          title: "Batalha PokédExplore",
          text: `Entre na sala ${roomCode}`,
          url,
        });
      else await navigator.clipboard.writeText(url);
      setNotice("Convite copiado/compartilhado!");
    } catch {}
  }

  return (
    <main className="battle-page">
      <div className="battle-shell">
        <header className="battle-header">
          <Link href="/#pokedex" className="battle-back">
            <ArrowLeft size={20} /> Pokédex
          </Link>
          <div className="battle-title">
            <span>ARENA</span>
            <h1>Pokémon</h1>
          </div>
          <span className="battle-header-actions">
            <Link href="/como-jogar" className="battle-help">
              <Question size={18} weight="bold" />
              <span>Como jogar</span>
            </Link>
            <CoinBalance />
            <span className="battle-round">3 × 3</span>
          </span>
        </header>
        {screen === "mode" && <ModeScreen onChoose={chooseMode} />}
        {screen === "friend" && (
          <FriendScreen
            name={name}
            setName={setName}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            onCreate={createRoom}
            onJoin={joinRoom}
            notice={notice}
          />
        )}
        {screen === "team" && (
          <>
            <RoomStatus
              mode={mode}
              roomCode={roomCode}
              player={player}
              presence={presence}
              notice={notice}
              connection={connection}
              ready={readySent}
              onShare={shareRoom}
            />{" "}
            <TeamSelector
              collection={collection}
              selected={selected}
              onToggle={togglePokemon}
              onReady={readyTeam}
              waiting={readySent}
              canReady={mode === "cpu" || connection === "CONNECTED"}
              onEquipmentChanged={(updated) => { setCollection((current) => current.map((pokemon) => String(pokemon.id) === String(updated.id) ? updated : pokemon)); setSelected((current) => current.map((pokemon) => String(pokemon.id) === String(updated.id) ? updated : pokemon)); }}
            />
          </>
        )}
        {screen === "battle" && battle && (
          <BattleArena
            state={battle}
            role={role}
            mode={mode}
            onAction={sendAction}
            onRematch={rematch}
          />
        )}
      </div>
    </main>
  );
}

function ModeScreen({ onChoose }) {
  const [difficulty, setDifficulty] = useState("normal");
  return (
    <section className="battle-panel mode-panel">
      <span className="eyebrow">ESCOLHA COMO JOGAR</span>
      <h2>Pronto para a arena?</h2>
      <p>Monte sua equipe capturada e desafie a CPU ou um amigo.</p>
      <div className="mode-options">
        <button type="button" onClick={() => onChoose("friend")}>
          <Users size={28} weight="fill" />
          <strong>Contra um amigo</strong>
          <small>Crie ou entre em uma sala</small>
        </button>
        <button type="button" onClick={() => onChoose("cpu", difficulty)}>
          <GameController size={28} weight="fill" />
          <strong>Contra a CPU · {difficulty}</strong>
          <small>Treine sua equipe</small>
        </button>
      </div>
      <div className="cpu-difficulty" role="group" aria-label="Dificuldade da CPU">
        {["easy", "normal", "hard"].map((option) => <button type="button" key={option} className={difficulty === option ? "selected" : ""} onClick={() => setDifficulty(option)} aria-pressed={difficulty === option}>{option === "easy" ? "Fácil" : option === "normal" ? "Normal" : "Difícil"}</button>)}
      </div>
    </section>
  );
}
function FriendScreen({
  name,
  setName,
  joinCode,
  setJoinCode,
  onCreate,
  onJoin,
  notice,
}) {
  return (
    <section className="battle-panel friend-panel">
      <span className="eyebrow">BATALHA ONLINE</span>
      <h2>Entre com seu treinador</h2>
      <label>
        Seu nome
        <input
          maxLength="18"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ex.: Renato"
        />
      </label>
      <div className="friend-actions">
        <button type="button" onClick={onCreate}>
          <LinkSimple size={24} /> Criar sala
        </button>
        <div>
          <label>
            Código da sala
            <span className="room-code-input">
              <b aria-hidden="true">{ROOM_PREFIX}</b>
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(getRoomDigits(event.target.value))
                }
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                placeholder="1234"
                aria-label="Quatro números do código da sala"
              />
            </span>
            <small>Digite somente os 4 números.</small>
          </label>
          <button type="button" onClick={onJoin}>
            Entrar na sala
          </button>
        </div>
      </div>
      {notice && (
        <p className="setup-notice" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
function RoomStatus({
  mode,
  roomCode,
  player,
  presence,
  notice,
  connection,
  ready,
  onShare,
}) {
  if (mode === "cpu")
    return (
      <div className="room-status">
        <span>Modo treino</span>
        <strong>CPU conectada</strong>
      </div>
    );
  const connected = Object.keys(presence).length;
  return (
    <div className="room-status">
      <div>
        <span>SALA</span>
        <strong>{roomCode}</strong>
      </div>
      <div>
        <small>
          Conexão:{" "}
          {connection === "CONNECTED"
            ? "conectada ✓"
            : connection.toLowerCase()}
        </small>
        <small>
          Você: {ready ? "PRONTO ✓" : `${player?.name} selecionando...`}
        </small>
        <small>
          Adversário: {connected > 1 ? "conectado ✓" : "aguardando..."}
        </small>
      </div>
      <button type="button" onClick={onShare}>
        <Copy size={18} /> Compartilhar
      </button>
      {notice && <em>{notice}</em>}
    </div>
  );
}
