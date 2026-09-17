"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  GameController,
  LinkSimple,
  Question,
  ShieldCheck,
  Sword,
  Trophy,
  Users,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
import { celebrateBadgeChampionship, celebrateBattleVictory } from "@/lib/celebration";
import { getJourneyNode } from "@/lib/journey";
import TournamentPanel from "@/components/Tournament/TournamentPanel";
import { ROUND, getTournamentReward } from "@/lib/tournament/config";
import { cancelTournament, completeTournamentMatch, createTournament, getPlayerActiveTournament, getTournament, joinTournament, leaveTournament, markTournamentMatchPlaying, startTournament, subscribeTournament } from "@/lib/tournament/service";
import BadgeArtwork from "@/components/Badges/BadgeArtwork";
import { getBadgeCpuTeam } from "@/lib/badges/cpu";
import { BADGE_REQUIRED_WINS, BADGE_TEAM_SIZE, getBadgeConfig } from "@/lib/badges/config";
import { acceptBadgeChallenge, getBadgeChallenge, getCompetitiveStatus, hasBadgeServiceConfig, markBadgeChallengeStarted, recordBadgeBattleResult, recordCompetitiveBattleActivity, registerCompetitivePlayer, subscribeBadgeChallenge, subscribeBadges } from "@/lib/badges/service";
import { getBadgeTeamErrorMessage, validateBadgeTeam } from "@/lib/badges/rules";
import { preloadBattlePokemonSprites } from "@/lib/pokemon/sprites";
import "./style.scss";

const makeCode = () => `PKDX-${Math.floor(1000 + Math.random() * 9000)}`;
const ROOM_PREFIX = "PKDX-";
const getRoomDigits = (value = "") =>
  String(value).replace(/\D/g, "").slice(0, 4);
const makePlayer = (name, playerId) => ({
  id: playerId || crypto.randomUUID(),
  name: name.trim() || "Treinador",
});
const makeMatchId = () => crypto.randomUUID();

export default function BattlePage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const journeyNode = getJourneyNode(params.get("journey"));
  const badgeChallengeId = params.get("badgeChallenge");
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
  const [profile, setProfile] = useState(null);
  const [tournament, setTournament] = useState(null);
  const [tournamentMatch, setTournamentMatch] = useState(null);
  const [tournamentCode, setTournamentCode] = useState("");
  const [tournamentBusy, setTournamentBusy] = useState(false);
  const [badgeChallenge, setBadgeChallenge] = useState(null);
  const [badgeResolution, setBadgeResolution] = useState(null);
  const [badgeResolving, setBadgeResolving] = useState(false);
  const [badgePreparing, setBadgePreparing] = useState(false);
  const [badgeResultError, setBadgeResultError] = useState("");
  const [isBadgeChampion, setIsBadgeChampion] = useState(false);
  const arenaBackgrounds = useRef([]);
  const isStartingBattle = useRef(false);
  const processedBadgeBattles = useRef(new Set());

  const loadArenaBackgrounds = useCallback(async () => {
    try {
      const response = await fetch("/api/arena-backgrounds", { cache: "no-store" });
      const data = response.ok ? await response.json() : { backgrounds: [] };
      if (Array.isArray(data.backgrounds)) arenaBackgrounds.current = data.backgrounds;
    } catch {}
    return arenaBackgrounds.current;
  }, []);

  useEffect(() => {
    void loadArenaBackgrounds();
  }, [loadArenaBackgrounds]);

  useEffect(() => {
    if (mode !== "tournament" || battle?.status !== "finished" || role !== "host" || !tournamentMatch) return;
    const winnerId = battle.winner === "host" ? tournamentMatch.player1_id : tournamentMatch.player2_id;
    void completeTournamentMatch(tournamentMatch.id, winnerId).then(setTournament).catch((error) => setNotice(error.message));
  }, [battle?.status, battle?.winner, mode, role, tournamentMatch]);

  useEffect(() => {
    webStore.getData("Pokedex").then(setCollection);
    webStore.getEconomy().then((economy) => setInventory(economy.inventory || {}));
    webStore.getLocalPlayerProfile().then((savedProfile) => { setProfile(savedProfile); setName((currentName) => currentName === "Treinador" ? savedProfile.displayName : currentName); void getPlayerActiveTournament(savedProfile.playerId).then(setTournament).catch(() => {}); });
    return () => {
      realtime.current?.leave();
      clearTimeout(cpuTimer.current);
      clearTimeout(introTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!profile || !hasBadgeServiceConfig()) return undefined;
    let unsubscribe;
    const refreshChampion = async () => {
      try {
        await registerCompetitivePlayer(profile);
        const status = await getCompetitiveStatus(profile.playerId);
        setIsBadgeChampion(status.isChampion);
      } catch { setIsBadgeChampion(false); }
    };
    void refreshChampion();
    try { unsubscribe = subscribeBadges(() => { void refreshChampion(); }); } catch {}
    return () => unsubscribe?.();
  }, [profile]);

  useEffect(() => {
    if (!profile || !badgeChallengeId || !hasBadgeServiceConfig()) return undefined;
    let active = true;
    const loadChallenge = async () => {
      try {
        const challenge = await getBadgeChallenge(badgeChallengeId);
        if (!active) return;
        if (!challenge) { setNotice("Este Desafio da Insígnia não foi encontrado."); setScreen("badge-intro"); return; }
        setBadgeChallenge(challenge);
        setBadgeResolution(null);
        setBadgeResultError("");
        const badgeMode = challenge.challenge_kind === "INITIAL_CPU" ? "badge-cpu" : "badge-pvp";
        const badgeRole = challenge.challenger_player_id === profile.playerId ? "host" : "guest";
        setMode(badgeMode);
        setRole(badgeRole);
        setPlayer({ id: profile.playerId, name: profile.displayName });
        setRoomCode(challenge.battle_room_code);
        setScreen("badge-intro");
      } catch (error) { if (active) { setNotice(error.message); setScreen("badge-intro"); } }
    };
    void loadChallenge();
    return () => { active = false; };
  }, [badgeChallengeId, profile]);

  useEffect(() => {
    if (!badgeChallengeId || !hasBadgeServiceConfig()) return undefined;
    let unsubscribe;
    const refresh = async () => {
      try {
        const latest = await getBadgeChallenge(badgeChallengeId);
        if (!latest) return;
        if (battle?.status === "finished") {
          setBadgeResolution(latest);
          setBadgeResolving(false);
        } else setBadgeChallenge(latest);
      } catch {}
    };
    try { unsubscribe = subscribeBadgeChallenge(badgeChallengeId, () => { void refresh(); }); } catch {}
    return () => unsubscribe?.();
  }, [badgeChallengeId, battle?.status]);

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
    const heldItem = effect.heldItem;
    if (heldItem?.consumed && heldItem.owner === localRole)
      void webStore.consumeHeldItem(heldItem.targetPokemonId, heldItem.itemId, `${state.matchId}:${state.revision}:held:${localRole}:${heldItem.targetPokemonId}:${heldItem.itemId}:${heldItem.eventId}`).then((result) => {
        if (result.ok) {
          setInventory(result.economy.inventory || {});
          if (result.pokemon) {
            setCollection((current) => current.map((pokemon) => String(pokemon.id) === String(result.pokemon.id) ? result.pokemon : pokemon));
            setSelected((current) => current.map((pokemon) => String(pokemon.id) === String(result.pokemon.id) ? result.pokemon : pokemon));
          }
        }
      });
  }, []);
  const startState = useCallback(
    async (hostTeam, guestTeam, host, guest) => {
      if (isStartingBattle.current) return;
      const badgeConfig = getBadgeConfig(badgeChallenge?.badge?.code);
      if (badgeConfig) {
        const hostValidation = validateBadgeTeam(hostTeam, badgeConfig.type);
        const guestValidation = validateBadgeTeam(guestTeam, badgeConfig.type);
        if (!hostValidation.valid || !guestValidation.valid) {
          const message = !hostValidation.valid
            ? getBadgeTeamErrorMessage(hostValidation, badgeConfig.localizedTypeName)
            : `A equipe adversária não atende ao formato da ${badgeConfig.name}.`;
          setNotice(message);
          if (!guestValidation.valid) broadcast(BATTLE_EVENTS.BADGE_ERROR, { message });
          return;
        }
      }
      isStartingBattle.current = true;
      void preloadBattlePokemonSprites([...hostTeam, ...guestTeam]);
      if (badgeChallenge?.challenge_kind === "PVP_TAKEOVER") {
        try {
          const startedChallenge = await markBadgeChallengeStarted({ challengeId: badgeChallenge.id, playerId: profile?.playerId });
          setBadgeChallenge((current) => ({ ...current, ...startedChallenge, badge: current?.badge || badgeChallenge.badge }));
        } catch (error) {
          isStartingBattle.current = false;
          setNotice(error.message);
          broadcast(BATTLE_EVENTS.BADGE_ERROR, { message: error.message });
          return;
        }
      }
      const backgrounds = await loadArenaBackgrounds();
      const next = createBattleState(
        { ...host, inventory: { potion: inventory.potion || 0, "full-heal": inventory["full-heal"] || 0 }, team: hostTeam.map(toBattlePokemon) },
        { ...guest, team: guestTeam.map(toBattlePokemon) },
      );
      next.matchId = makeMatchId();
      if (badgeChallenge) {
        next.badgeChallengeId = badgeChallenge.id;
        next.seriesBattleNumber = badgeChallenge.current_battle;
      }
      if (backgrounds.length) next.arenaBackground = backgrounds[Math.floor(Math.random() * backgrounds.length)];
      next.status = "countdown";
      next.log = "3 · 2 · 1 · BATALHA!";
      setBattle(next);
      setScreen("battle");
      isStartingBattle.current = false;
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
    [badgeChallenge, broadcast, inventory, loadArenaBackgrounds, profile?.playerId],
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
      const justFinished = previous?.status !== "finished" && next?.status === "finished";
      if (justFinished && profile && hasBadgeServiceConfig() && !String(mode).startsWith("badge")) {
        void recordCompetitiveBattleActivity({ battleId: next.matchId, playerId: profile.playerId, displayName: profile.displayName, battleMode: mode }).catch(() => {});
      }
      if (mode !== "tournament" && justFinished) {
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
      if (justFinished && String(mode).startsWith("badge") && badgeChallenge) {
        setBadgeResolving(true);
        setBadgeResultError("");
        if (localRole === "host" && !processedBadgeBattles.current.has(next.matchId)) {
          processedBadgeBattles.current.add(next.matchId);
          const winnerPlayerId = next.winner === "host"
            ? badgeChallenge.challenger_player_id
            : badgeChallenge.challenge_kind === "INITIAL_CPU" ? "CPU" : badgeChallenge.defender_player_id;
          void recordBadgeBattleResult({ challengeId: badgeChallenge.id, battleId: next.matchId, winnerPlayerId }).then((resolution) => {
            setBadgeResolution(resolution);
            setBadgeResolving(false);
            if (resolution.status === "COMPLETED") {
              celebrateBadgeChampionship(getBadgeConfig(badgeChallenge.badge?.code)?.color);
              setIsBadgeChampion(true);
            }
          }).catch((error) => { setBadgeResultError(error.message); setBadgeResolving(false); });
        } else if (localRole !== "host") {
          window.setTimeout(() => { void getBadgeChallenge(badgeChallenge.id).then((resolution) => { setBadgeResolution(resolution); setBadgeResolving(false); }).catch(() => {}); }, 700);
        }
      }
      if (
        justFinished &&
        next.winner === localRole &&
        ["cpu", "friend"].includes(mode)
      ) {
        const performance = next.performance || {};
        const reward = calculateBattleRewards({
          won: true,
          durationMs: performance.endedAt - performance.startedAt,
          usedOnlyOnePokemon: !performance.players?.[localRole]?.hasSwitched,
          championBonusEligible: isBadgeChampion,
        });
        celebrateBattleVictory();
        void awardVictory(next.matchId, reward.total);
      }
      return next;
    },
    [awardVictory, badgeChallenge, isBadgeChampion, journeyNode, mode, profile],
  );

  useEffect(() => {
    if (mode !== "tournament" || battle?.status !== "finished" || battle.winner !== role || !tournamentMatch || !profile) return;
    const rewardId = `tournament:${tournamentMatch.tournament_id}:match:${tournamentMatch.id}:winner:${profile.playerId}`;
    void completeTournamentMatch(tournamentMatch.id, profile.playerId).then(async (updated) => {
      setTournament(updated);
      const reward = await awardVictory(rewardId, getTournamentReward(tournamentMatch.round));
      if (reward.rewarded) setNotice(`${tournamentMatch.round === ROUND.FINAL ? "CAMPEÃO!" : "SEMIFINAL VENCIDA!"} +${getTournamentReward(tournamentMatch.round)} moedas`);
      celebrateBattleVictory();
    }).catch((error) => setNotice(error.message));
  }, [battle?.status, battle?.winner, mode, profile, role, tournamentMatch, awardVictory]);

  useEffect(() => {
    if (!tournament?.id || !["LOBBY", "SEMIFINALS", "FINAL"].includes(tournament.status)) return undefined;
    const refreshTournament = async () => {
      try {
        const current = await getTournament(tournament.id);
        if (process.env.NODE_ENV !== "production") console.info("[Tournament] UI STATE AFTER EVENT", { tournamentId: tournament.id, participantCount: current?.tournament_players.length || 0, participantIds: current?.tournament_players.map((item) => item.player_id) || [] });
        setTournament(current);
      } catch (error) { if (process.env.NODE_ENV !== "production") console.error("[Tournament] POST-EVENT FETCH FAILED", error); }
    };
    const unsubscribe = subscribeTournament(tournament.id, () => { void refreshTournament(); });
    const timer = window.setInterval(() => { void refreshTournament(); }, 10_000);
    return () => { unsubscribe(); window.clearInterval(timer); };
  }, [tournament?.id, tournament?.status]);

  useEffect(() => {
    if (mode !== "tournament" || tournament?.status !== "CANCELLED") return;
    realtime.current?.leave();
    setBattle(null);
    setRemoteTeam(null);
    setReadySent(false);
    setTournamentMatch(null);
    setScreen("tournament");
    setNotice(tournament.cancellation_reason === "INACTIVITY" ? "Campeonato encerrado: não houve partida em andamento por 5 minutos." : "O organizador encerrou o campeonato.");
  }, [mode, tournament?.cancellation_reason, tournament?.status]);

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
                if (next === previous) return previous;
                persistBattleConsumables(next, currentRole);
                broadcast(BATTLE_EVENTS.STATE, next);
                return rewardFinishedBattle(previous, next, currentRole);
              });
            if (type === BATTLE_EVENTS.BADGE_ERROR && payload?.message)
              setNotice(payload.message);
            if (type === BATTLE_EVENTS.REMATCH) {
              setBattle(null);
              setSelected([]);
              setRemoteTeam(null);
              setReadySent(false);
              void realtime.current?.updatePresence({ ready: false, team: null }).catch(() => {});
              setScreen("team");
              setNotice(
                String(mode).startsWith("badge") ? "A próxima batalha está pronta. Escolha sua equipe novamente." : "Seu adversário quer uma revanche. Escolha sua equipe novamente.",
              );
            }
          },
        });
      } catch {
        setNotice("Não foi possível conectar à sala.");
      }
    },
    [broadcast, mode, persistBattleConsumables, rewardFinishedBattle],
  );

  useEffect(() => {
    if (
      !["friend", "tournament", "badge-pvp"].includes(mode) ||
      role !== "host" ||
      !readySent ||
      selected.length !== 3 ||
      !remoteTeam ||
      !player ||
      battle
    )
      return;
    if (mode === "tournament" && tournamentMatch) {
      void markTournamentMatchPlaying(tournamentMatch.id).catch((error) => setNotice(error.message));
    }
    startState(selected, remoteTeam.team, player, remoteTeam.player);
  }, [mode, role, readySent, selected, remoteTeam, player, battle, startState, tournamentMatch]);

  useEffect(() => {
    if (
      !["cpu", "badge-cpu"].includes(mode) ||
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
          const strategicCpu = cpuDifficulty === "hard" || mode === "badge-cpu";
          const shouldSwitch = strategicCpu && reserveIndex >= 0 && getPokemonMatchup(active, enemy) === "disadvantage" && active.hp / active.maxHp < .65;
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
                    moveId: (cpuDifficulty === "easy" && mode !== "badge-cpu" ? regularMove : strategicCpu ? bestMove : useSpecial ? specialMove : regularMove)?.id || "strike",
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
    setScreen(nextMode === "cpu" ? "team" : nextMode === "tournament" ? "tournament" : "friend");
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
    const badgeConfig = getBadgeConfig(badgeChallenge?.badge?.code);
    if (badgeConfig) {
      const validation = validateBadgeTeam(selected, badgeConfig.type);
      if (!validation.valid) {
        setNotice(getBadgeTeamErrorMessage(validation, badgeConfig.localizedTypeName));
        return;
      }
    }
    if (["cpu", "badge-cpu"].includes(mode)) {
      const local = makePlayer(name, profile?.playerId);
      setPlayer(local);
      const journeyTeam = mode === "badge-cpu"
        ? getBadgeCpuTeam(badgeConfig.type, badgeChallenge.current_battle)
        : journeyNode ? journeyNode.team.map((entry) => { const rosterEntry = CPU_ROSTER.find((pokemon) => pokemon.id === (entry.id || entry)) || CPU_TEAM[0]; return { ...rosterEntry, level: entry.level || rosterEntry.level }; }) : CPU_TEAM;
      startState(selected, journeyTeam, local, { id: "cpu", name: mode === "badge-cpu" ? badgeConfig.leaderName : journeyNode?.badge ? "Líder do Ginásio" : journeyNode ? journeyNode.title : "CPU" });
      return;
    }
    if (!realtime.current?.isConnected()) {
      setNotice("Ainda conectando à sala. Aguarde antes de confirmar.");
      return;
    }
    const payload = { player: { ...player, inventory: { potion: inventory.potion || 0, "full-heal": inventory["full-heal"] || 0 } }, team: selected.map(toBattlePokemon) };
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
    const currentPlayer = makePlayer(name, profile?.playerId);
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
    const currentPlayer = makePlayer(name, profile?.playerId);
    setName(currentPlayer.name);
    void webStore.setTrainerName(currentPlayer.name);
    const code = `${ROOM_PREFIX}${joinCode}`;
    setPlayer(currentPlayer);
    setRole("guest");
    setRoomCode(code);
    setScreen("team");
    connectRoom(code, currentPlayer, "guest");
  }
  async function prepareBadgeChallenge() {
    if (!badgeChallenge || !profile) return;
    if (!["ACTIVE", "PENDING_ACCEPTANCE"].includes(badgeChallenge.status)) {
      router.push("/jornada/insignias");
      return;
    }
    const participant = [badgeChallenge.challenger_player_id, badgeChallenge.defender_player_id].includes(profile.playerId);
    if (!participant) {
      setNotice("Somente o desafiante e o campeão podem entrar nesta disputa.");
      return;
    }
    const currentRole = badgeChallenge.challenger_player_id === profile.playerId ? "host" : "guest";
    const currentPlayer = { id: profile.playerId, name: profile.displayName };
    setBadgePreparing(true);
    try {
      let preparedChallenge = badgeChallenge;
      if (badgeChallenge.challenge_kind === "PVP_TAKEOVER" && currentRole === "guest" && badgeChallenge.status === "PENDING_ACCEPTANCE") {
        const accepted = await acceptBadgeChallenge({ challengeId: badgeChallenge.id, playerId: profile.playerId });
        preparedChallenge = { ...badgeChallenge, ...accepted, badge: badgeChallenge.badge };
        setBadgeChallenge(preparedChallenge);
      }
      setRole(currentRole);
      setPlayer(currentPlayer);
      setSelected([]);
      setRemoteTeam(null);
      setBattle(null);
      setReadySent(false);
      setBadgeResolution(null);
      setBadgeResultError("");
      if (preparedChallenge.challenge_kind === "PVP_TAKEOVER") connectRoom(preparedChallenge.battle_room_code, currentPlayer, currentRole);
      setScreen("team");
    } catch (error) {
      setNotice(error.message);
    } finally {
      setBadgePreparing(false);
    }
  }
  async function createTournamentFlow() {
    if (!profile) return setNotice("Carregando seu perfil local...");
    setTournamentBusy(true); try { const nextProfile = await webStore.setLocalPlayerProfile({ ...profile, displayName: name.trim() || profile.displayName }); setProfile(nextProfile); setName(nextProfile.displayName); const active = await getPlayerActiveTournament(nextProfile.playerId); if (active) { setTournament(active); return setNotice("Você já está em um campeonato. Volte ao campeonato em andamento."); } setTournament(await createTournament(nextProfile)); }
    catch (error) { setNotice(error.message); } finally { setTournamentBusy(false); }
  }
  async function joinTournamentFlow() {
    if (!profile) return setNotice("Carregando seu perfil local...");
    setTournamentBusy(true); try { const nextProfile = await webStore.setLocalPlayerProfile({ ...profile, displayName: name.trim() || profile.displayName }); setProfile(nextProfile); setName(nextProfile.displayName); const active = await getPlayerActiveTournament(nextProfile.playerId); if (active) { setTournament(active); return setNotice("Você já está em um campeonato. Volte ao campeonato em andamento."); } const joined = await joinTournament(tournamentCode, nextProfile); setTournament(joined); setNotice(joined.joinOutcome?.alreadyJoined ? "Você já participa deste campeonato." : "Você entrou no campeonato."); }
    catch (error) { setNotice(error.message); } finally { setTournamentBusy(false); }
  }
  async function resetTournamentIdentity() {
    if (tournament) return setNotice("Volte ao hub antes de gerar uma nova identidade de teste.");
    const nextProfile = await webStore.resetLocalPlayerIdentity();
    setProfile(nextProfile);
    setName(nextProfile.displayName);
    setNotice("Nova identidade local de teste gerada.");
    if (process.env.NODE_ENV !== "production") console.info("[Tournament] LOCAL IDENTITY RESET", nextProfile);
  }
  async function startTournamentFlow() {
    if (!tournament || !profile) return; setTournamentBusy(true);
    try { setTournament(await startTournament(tournament.id, profile.playerId)); }
    catch (error) { setNotice(error.message); } finally { setTournamentBusy(false); }
  }
  async function cancelTournamentFlow() {
    if (!tournament || !profile) return;
    setTournamentBusy(true);
    try {
      await cancelTournament(tournament.id, profile.playerId);
      setTournament(null);
      setTournamentMatch(null);
      setTournamentCode("");
      setNotice("Campeonato cancelado. Você já pode criar um novo.");
    }
    catch (error) { setNotice(error.message); } finally { setTournamentBusy(false); }
  }
  async function leaveTournamentFlow() {
    if (!tournament || !profile) return;
    setTournamentBusy(true);
    try {
      await leaveTournament(tournament.id, profile.playerId);
      setTournament(null);
      setTournamentMatch(null);
      setNotice("Você saiu do campeonato. Sua vaga foi liberada.");
    }
    catch (error) {
      setNotice(error.message || "Não foi possível sair do campeonato. Tente novamente.");
      void getTournament(tournament.id).then(setTournament).catch(() => {});
    } finally { setTournamentBusy(false); }
  }
  async function enterTournamentMatch(match) {
    if (!profile) return;
    const currentPlayer = { id: profile.playerId, name: name.trim() || profile.displayName };
    const currentRole = match.player1_id === profile.playerId ? "host" : "guest";
    setMode("tournament"); setTournamentMatch(match); setPlayer(currentPlayer); setRole(currentRole); setRoomCode(match.battle_room_code); setSelected([]); setBattle(null); setReadySent(false); setScreen("team");
    try { connectRoom(match.battle_room_code, currentPlayer, currentRole); }
    catch (error) { setNotice(error.message); setScreen("tournament"); }
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
    if (String(mode).startsWith("badge")) {
      const terminal = ["COMPLETED", "FAILED", "EXPIRED", "CANCELLED"].includes(badgeResolution?.status);
      if (terminal) {
        realtime.current?.leave();
        router.push("/jornada/insignias");
        return;
      }
      if (badgeResolution?.status === "ACTIVE") {
        setBadgeChallenge((current) => ({ ...current, ...badgeResolution, badge: current.badge }));
        if (mode === "badge-pvp") {
          void realtime.current?.updatePresence({ ready: false, team: null }).catch(() => {});
          broadcast(BATTLE_EVENTS.REMATCH, {});
        }
        setBattle(null);
        setSelected([]);
        setRemoteTeam(null);
        setReadySent(false);
        setBadgeResolution(null);
        setBadgeResultError("");
        setScreen("team");
      }
      return;
    }
    if (mode === "tournament") { realtime.current?.leave(); setBattle(null); setSelected([]); setRemoteTeam(null); setReadySent(false); setTournamentMatch(null); setScreen("tournament"); void getTournament(tournament?.id).then(setTournament).catch(() => {}); return; }
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
    <main
      className="battle-page"
      style={
        battle?.arenaBackground
          ? { "--battle-background": `url("${battle.arenaBackground}")` }
          : undefined
      }
    >
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
            <span className="battle-round">{String(mode).startsWith("badge") ? `${badgeChallenge?.challenger_wins || 0}/${BADGE_REQUIRED_WINS} · 3 × 3` : "3 × 3"}</span>
          </span>
        </header>
        {screen === "mode" && <ModeScreen onChoose={chooseMode} activeTournament={tournament} onResumeTournament={() => { setMode("tournament"); setScreen("tournament"); }} />}
        {screen === "tournament" && <TournamentPanel tournament={tournament} profile={profile || {}} name={name} setName={setName} code={tournamentCode} setCode={setTournamentCode} notice={notice} busy={tournamentBusy} onCreate={createTournamentFlow} onJoin={joinTournamentFlow} onResetIdentity={resetTournamentIdentity} onStart={startTournamentFlow} onCancel={cancelTournamentFlow} onLeave={leaveTournamentFlow} onEnterMatch={enterTournamentMatch} onBack={() => setScreen("mode")} />}
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
        {screen === "badge-intro" && <BadgeChallengeIntro challenge={badgeChallenge} profile={profile} notice={notice} busy={badgePreparing} onPrepare={prepareBadgeChallenge} onBack={() => router.push("/jornada/insignias")} />}
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
              canReady={["cpu", "badge-cpu"].includes(mode) || connection === "CONNECTED"}
              onUseDeck={setSelected}
              badgeContext={String(mode).startsWith("badge") ? getBadgeConfig(badgeChallenge?.badge?.code) : null}
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
            tournamentContext={mode === "tournament" && tournamentMatch ? { round: tournamentMatch.round, reward: getTournamentReward(tournamentMatch.round) } : null}
            championBonusEligible={isBadgeChampion && ["cpu", "friend"].includes(mode)}
            badgeContext={String(mode).startsWith("badge") && badgeChallenge ? { config: getBadgeConfig(badgeChallenge.badge?.code), challenge: badgeChallenge, resolution: badgeResolution, resolving: badgeResolving, error: badgeResultError, playerId: profile?.playerId } : null}
          />
        )}
      </div>
    </main>
  );
}

function BadgeChallengeIntro({ challenge, profile, notice, busy, onPrepare, onBack }) {
  if (!challenge) return <section className="battle-panel badge-challenge-intro"><span className="eyebrow">DESAFIO DA INSÍGNIA</span><h2>Carregando disputa...</h2>{notice && <p className="setup-notice" role="alert">{notice}</p>}<button type="button" className="badge-intro-back" onClick={onBack}>Voltar às Insígnias</button></section>;
  const config = getBadgeConfig(challenge.badge?.code);
  const participant = [challenge.challenger_player_id, challenge.defender_player_id].includes(profile?.playerId);
  const isChallenger = challenge.challenger_player_id === profile?.playerId;
  const isWaitingForChampion = challenge.challenge_kind === "PVP_TAKEOVER" && challenge.status === "PENDING_ACCEPTANCE";
  const terminal = !["ACTIVE", "PENDING_ACCEPTANCE"].includes(challenge.status);
  return <section className="battle-panel badge-challenge-intro" style={{ "--badge-color": config.color }}>
    <div className="badge-intro-hero"><BadgeArtwork badge={config} /><div><span className="eyebrow">DESAFIO DA INSÍGNIA</span><h2>{config.name}</h2><p>Batalha {challenge.current_battle} · {challenge.challenger_wins}/{challenge.wins_required} vitórias consecutivas</p></div></div>
    <div className="badge-intro-versus"><article><span>DESAFIANTE</span><strong>{challenge.challenger_name}</strong></article><b>VS</b><article><span>{challenge.challenge_kind === "INITIAL_CPU" ? "LÍDER" : "CAMPEÃO"}</span><strong>{challenge.challenge_kind === "INITIAL_CPU" ? config.leaderName : challenge.defender_name}</strong></article></div>
    <section className="badge-intro-rules" aria-labelledby="badge-intro-rules-title"><span className="eyebrow">CONDIÇÃO DE CONQUISTA</span><h3 id="badge-intro-rules-title">Uma série perfeita</h3><ul><li><Trophy weight="fill" /> Vença {BADGE_REQUIRED_WINS} batalhas consecutivas.</li><li><Check weight="bold" /> Ambos levam pelo menos 1 Pokémon {config.localizedTypeName}.</li><li><ShieldCheck weight="fill" /> Equipes de {BADGE_TEAM_SIZE}, sem Lendários ou Míticos.</li><li><Sword weight="fill" /> A equipe pode mudar entre as batalhas.</li></ul></section>
    {notice && <p className="setup-notice" role="alert">{notice}</p>}
    <div className="badge-intro-actions"><button type="button" className="badge-intro-back" onClick={onBack} disabled={busy}>Voltar</button><button type="button" className="badge-intro-prepare" onClick={terminal ? onBack : onPrepare} disabled={busy || (!participant && !terminal)}>{busy ? "Confirmando..." : terminal ? "Ver Insígnias" : !participant ? "Disputa em andamento" : isWaitingForChampion ? isChallenger ? "Preparar e aguardar" : "Aceitar defesa" : "Preparar equipe"}</button></div>
  </section>;
}

function ModeScreen({ onChoose, activeTournament, onResumeTournament }) {
  const [difficulty, setDifficulty] = useState("normal");
  return (
    <section className="battle-panel mode-panel">
      <span className="eyebrow">ESCOLHA COMO JOGAR</span>
      <h2>Pronto para a arena?</h2>
      <p>Monte sua equipe capturada e desafie a CPU ou um amigo.</p>
      {activeTournament && <div className="tournament-resume" role="status"><div><strong>Campeonato em andamento</strong><small>{activeTournament.code} · {activeTournament.status === "LOBBY" ? "aguardando jogadores" : activeTournament.status === "FINAL" ? "sua final pode estar pronta" : "chave em andamento"}</small></div><button type="button" onClick={onResumeTournament}>Voltar ao campeonato</button></div>}
      <div className="mode-options">
        <button type="button" onClick={() => onChoose("friend")}>
          <Users size={28} weight="fill" />
          <strong>Contra um amigo</strong>
          <small>Crie ou entre em uma sala</small>
        </button>
        <button type="button" onClick={() => onChoose("tournament")}>
          <Trophy size={28} weight="fill" />
          <strong>Campeonato</strong>
          <small>4 jogadores · chave eliminatória</small>
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
  if (["cpu", "badge-cpu"].includes(mode))
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
