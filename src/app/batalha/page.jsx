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
import BattleDebugPanel from "@/components/Battle/BattleDebugPanel";
import { CPU_ROSTER, CPU_TEAM, toBattlePokemon } from "@/lib/battle/pokemon";
import { createBattleState, resolveAction } from "@/lib/battle/engine";
import { createCpuInventory, createCpuVictoryReward, decideCpuIntent, generateCpuTeam, getCpuDifficulty } from "@/lib/battle/cpu";
import { canStartWagerBattle, getWagerPot, normalizeWagerAmount } from "@/lib/battle/wager";
import { completeSelection, createSelectionTiming, getReadySelection, getSelectionTimerState } from "@/lib/battle/selectionTimer";
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
import { validateHeldItemAssignments } from "@/lib/economy/heldItems";
import { BAG_ITEM_CATALOG } from "@/lib/items/catalog";
import { getItemConsumptionEvents } from "@/lib/battle/itemConsumption";
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
  const [myReady, setMyReady] = useState(false);
  const [opponentReady, setOpponentReady] = useState(false);
  const [wager, setWager] = useState(null);
  const [selectionTiming, setSelectionTiming] = useState(null);
  const wagerSnapshot = useRef(null);
  const battleSnapshot = useRef(null);
  const selectionTimingSnapshot = useRef(null);
  const autoSelectionSessions = useRef(new Set());
  const [preparingTeam, setPreparingTeam] = useState(false);
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
  const recentCpuTeams = useRef([]);

  useEffect(() => {
    wagerSnapshot.current = wager;
  }, [wager]);

  useEffect(() => {
    battleSnapshot.current = battle;
  }, [battle]);

  useEffect(() => {
    selectionTimingSnapshot.current = selectionTiming;
  }, [selectionTiming]);

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
  const publishFriendSelectionTiming = useCallback((nextTiming) => {
    selectionTimingSnapshot.current = nextTiming;
    setSelectionTiming(nextTiming);
    if (nextTiming) {
      void realtime.current?.updatePresence({ selectionTiming: nextTiming }).catch(() => {});
      broadcast(BATTLE_EVENTS.SELECTION_TIMER, nextTiming);
    }
  }, [broadcast]);
  const beginFriendSelectionTiming = useCallback(() => {
    if (selectionTimingSnapshot.current) return selectionTimingSnapshot.current;
    const nextTiming = createSelectionTiming();
    publishFriendSelectionTiming(nextTiming);
    return nextTiming;
  }, [publishFriendSelectionTiming]);
  const clearFriendSelectionTiming = useCallback(() => {
    selectionTimingSnapshot.current = null;
    setSelectionTiming(null);
    autoSelectionSessions.current.clear();
  }, []);
  const persistBattleConsumables = useCallback((state, localRole) => {
    getItemConsumptionEvents(state, localRole).forEach((event) =>
      void webStore.settleBattleItemConsumption(event).then((result) => {
        if (result.ok) {
          setInventory(result.economy.inventory || {});
          if (result.pokemon) {
            setCollection((current) => current.map((pokemon) => String(pokemon.id) === String(result.pokemon.id) ? result.pokemon : pokemon));
            setSelected((current) => current.map((pokemon) => String(pokemon.id) === String(result.pokemon.id) ? result.pokemon : pokemon));
          }
        }
      }));
  }, []);
  const startState = useCallback(
    async (hostTeam, guestTeam, host, guest, cpuContext = null) => {
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
        { ...host, inventory: Object.fromEntries(BAG_ITEM_CATALOG.map((item) => [item.id, inventory[item.id] || 0])), team: hostTeam.map(toBattlePokemon) },
        { ...guest, inventory: guest.inventory || {}, team: guestTeam.map(toBattlePokemon) },
      );
      next.matchId = makeMatchId();
      if (mode === "friend" && wager?.status === "LOCKED") next.wager = wager;
      if (cpuContext) next.cpuDifficulty = cpuContext.difficulty;
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
    [badgeChallenge, broadcast, inventory, loadArenaBackgrounds, mode, profile?.playerId, wager],
  );
  const awardVictory = useCallback(
    async (matchId, amount, itemId = null) => {
      const reward = await webStore.rewardVictory(matchId, amount, itemId);
      dispatch(actCoins(reward.coins));
      return reward;
    },
    [dispatch],
  );
  const rewardFinishedBattle = useCallback(
    (previous, next, localRole) => {
      const justFinished = previous?.status !== "finished" && next?.status === "finished";
      if (justFinished && mode === "cpu" && next.winner === localRole && !next.cpuReward)
        next.cpuReward = createCpuVictoryReward(next.cpuDifficulty || cpuDifficulty);
      if (justFinished && mode === "friend" && next.wager?.id) {
        void webStore.settleWager(next.wager.id, { won: next.winner === localRole, refund: !next.winner }).then((result) => { if (result.settled) dispatch(actCoins(result.coins)); });
      }
      if (justFinished && profile && hasBadgeServiceConfig() && !String(mode).startsWith("badge")) {
        void recordCompetitiveBattleActivity({ battleId: next.matchId, playerId: profile.playerId, displayName: profile.displayName, battleMode: mode }).catch(() => {});
      }
      if (mode !== "tournament" && justFinished) {
        const performance = next.performance || {};
        const won = next.winner === localRole;
        void webStore.recordBattleOutcome(next.matchId, {
          won,
          mode,
          durationMs: performance.endedAt - performance.startedAt,
          usedOnlyOnePokemon: !performance.players?.[localRole]?.hasSwitched,
        }).then((result) => {
          if (result.rewardCoins) dispatch(actCoins(result.coins));
          if (result.unlocked?.length) setNotice("CONQUISTA DESBLOQUEADA: " + result.unlocked.join(", ").toUpperCase() + (result.rewardCoins ? ` +${result.rewardCoins} moedas` : ""));
        });
        if (journeyNode && won) void webStore.completeJourneyNode(journeyNode).then((result) => { if (result.completed) setNotice(journeyNode.badge ? "INSÍGNIA CONQUISTADA: " + journeyNode.badge : "ROTA CONCLUÍDA! +" + journeyNode.reward + " moedas"); });
      }
      if (justFinished && (mode === "tournament" || String(mode).startsWith("badge"))) {
        void webStore.recordPlayerBattleResult(next.matchId, { won: next.winner === localRole, mode });
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
          baseCoins: mode === "cpu" ? next.cpuReward?.baseCoins : undefined,
        });
        celebrateBattleVictory();
        void awardVictory(next.matchId, reward.total, mode === "cpu" ? next.cpuReward?.itemId : null);
      }
      return next;
    },
    [awardVictory, badgeChallenge, cpuDifficulty, dispatch, isBadgeChampion, journeyNode, mode, profile],
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
        if (process.env.NODE_ENV !== "production") console.info("[Tournament] UI STATE AFTER EVENT", { tournamentId: tournament.id, participantCount: current?.tournament_players?.length || 0, participantIds: current?.tournament_players?.map((item) => item.player_id) || [] });
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
    setMyReady(false);
    setOpponentReady(false);
    setTournamentMatch(null);
    setScreen("tournament");
    setNotice(tournament.cancellation_reason === "INACTIVITY" ? "Campeonato encerrado: não houve partida em andamento por 5 minutos." : "O organizador encerrou o campeonato.");
  }, [mode, tournament?.cancellation_reason, tournament?.status]);

  const connectRoom = useCallback(
    (code, currentPlayer, currentRole, initialWager = null) => {
      try {
        realtime.current?.leave();
        realtime.current = createBattleRoom(code, initialWager ? { ...currentPlayer, wager: initialWager } : currentPlayer, {
          onPresence: (nextPresence) => {
            setPresence(nextPresence);
            const players = Object.values(nextPresence).flat();
            const peer = players.find((item) => item.id !== currentPlayer.id);
            if (peer) {
              if (peer.wager?.id) setWager(peer.wager);
              if (peer.selectionTiming?.id) {
                selectionTimingSnapshot.current = peer.selectionTiming;
                setSelectionTiming(peer.selectionTiming);
                if (currentRole === "guest") void realtime.current?.updatePresence({ selectionTiming: peer.selectionTiming }).catch(() => {});
              }
              const activeWager = wagerSnapshot.current;
              if (mode === "friend" && currentRole === "host" && (!activeWager || activeWager.status === "LOCKED")) beginFriendSelectionTiming();
              // Always update the team snapshot when peer publishes it
              if (Array.isArray(peer.team)) {
                setRemoteTeam({ player: { id: peer.id, name: peer.name }, team: peer.team });
              }
              // Track readiness SEPARATELY — knowing their team ≠ they pressed PRONTO
              setOpponentReady(peer.ready === true);
              if (peer.ready === true) setNotice("ADVERSÁRIO PRONTO!");
              else if (peer.ready === false) setNotice("Adversário voltou a selecionar o time...");
            } else {
              setOpponentReady(false);
              setRemoteTeam(null);
              const activeWager = wagerSnapshot.current;
              if (!battleSnapshot.current && activeWager?.status === "LOCKED") {
                setWager(null);
                void webStore.settleWager(activeWager.id, { refund: true }).then((result) => {
                  if (result.settled) dispatch(actCoins(result.coins));
                });
                setNotice("Adversário desconectou. Aposta devolvida.");
              }
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
            // TEAM broadcast: backward-compat team snapshot. Does NOT imply opponent pressed PRONTO.
            if (type === BATTLE_EVENTS.TEAM && payload?.player?.id !== currentPlayer.id) {
              setRemoteTeam(payload);
            }
            if (type === BATTLE_EVENTS.WAGER_PROPOSAL && payload?.hostId !== currentPlayer.id) setWager(payload);
            if (type === BATTLE_EVENTS.WAGER_ACCEPT && currentRole === "host" && payload?.wager?.hostId === currentPlayer.id) {
              const proposed = payload.wager;
              void webStore.reserveWager(proposed.id, proposed.amount).then((result) => {
                if (!result.ok) { broadcast(BATTLE_EVENTS.WAGER_REJECTED, { wagerId: proposed.id }); setNotice("Seu saldo não permite bloquear esta aposta."); return; }
                dispatch(actCoins(result.coins));
                const locked = { ...proposed, guestId: payload.playerId, status: "LOCKED" };
                wagerSnapshot.current = locked;
                setWager(locked); void realtime.current?.updatePresence({ wager: locked }); broadcast(BATTLE_EVENTS.WAGER_LOCKED, locked);
                beginFriendSelectionTiming();
              });
            }
            if (type === BATTLE_EVENTS.WAGER_LOCKED && payload?.id) { wagerSnapshot.current = payload; setWager(payload); setNotice("APOSTA ACEITA · moedas reservadas"); }
            if (type === BATTLE_EVENTS.WAGER_REJECTED && payload?.wagerId) { void webStore.settleWager(payload.wagerId, { refund: true }); wagerSnapshot.current = null; setWager(null); setNotice("A aposta não pôde ser bloqueada."); }
            if (type === BATTLE_EVENTS.SELECTION_TIMER && payload?.id) {
              selectionTimingSnapshot.current = payload;
              setSelectionTiming(payload);
              void realtime.current?.updatePresence({ selectionTiming: payload }).catch(() => {});
            }
            // READY: explicit per-player readiness. This is the authoritative ready signal.
            if (type === BATTLE_EVENTS.READY && payload?.playerId && payload.playerId !== currentPlayer.id) {
              const isReady = payload.ready === true;
              setOpponentReady(isReady);
              if (isReady) {
                if (Array.isArray(payload.team)) {
                  setRemoteTeam((prev) =>
                    prev
                      ? { ...prev, team: payload.team }
                      : { player: { id: payload.playerId, name: payload.playerName || "Adversário" }, team: payload.team }
                  );
                }
                setNotice("ADVERSÁRIO PRONTO!");
              } else {
                setNotice("Adversário voltou a selecionar o time...");
              }
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
              setWager(null);
              clearFriendSelectionTiming();
              setBattle(null);
              setSelected([]);
              setRemoteTeam(null);
              setMyReady(false);
              setOpponentReady(false);
              void realtime.current?.updatePresence({ ready: false, team: null, selectionTiming: null }).catch(() => {});
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
    [beginFriendSelectionTiming, broadcast, clearFriendSelectionTiming, dispatch, mode, persistBattleConsumables, rewardFinishedBattle],
  );

  useEffect(() => {
    if (
      !["friend", "tournament", "badge-pvp"].includes(mode) ||
      role !== "host" ||
      !myReady ||              // host must have explicitly pressed PRONTO
      !opponentReady ||        // guest must have ALSO explicitly pressed PRONTO
      !canStartWagerBattle(wager) ||
      selected.length !== 3 ||
      !remoteTeam?.team ||
      remoteTeam.team.length !== 3 ||
      !player ||
      battle ||
      isStartingBattle.current
    )
      return;
    if (mode === "tournament" && tournamentMatch) {
      void markTournamentMatchPlaying(tournamentMatch.id).catch((error) => setNotice(error.message));
    }
    void startState(selected, remoteTeam.team, player, remoteTeam.player).catch((error) => {
      isStartingBattle.current = false;
      setNotice(error?.message || "Não foi possível iniciar a batalha.");
      console.error("[Battle start error]", error);
    });
  }, [mode, role, myReady, opponentReady, selected, remoteTeam, player, battle, startState, tournamentMatch, wager]);

  useEffect(() => {
    if (mode !== "friend" || !selectionTiming?.id || myReady || battle || !player?.id) return undefined;
    const timerState = getSelectionTimerState(selectionTiming);
    const autoConfirm = async () => {
      const sessionKey = `${selectionTiming.id}:${player.id}`;
      if (autoSelectionSessions.current.has(sessionKey)) return;
      autoSelectionSessions.current.add(sessionKey);
      const currentCollection = await webStore.getData("Pokedex");
      const resolvedTeam = completeSelection(currentCollection, selected);
      if (resolvedTeam.length !== 3) {
        setNotice("Você precisa ter pelo menos 3 Pokémon para entrar em uma batalha PvP.");
        return;
      }
      setCollection(currentCollection);
      setSelected(resolvedTeam);
      setNotice("Tempo encerrado. Seu time foi confirmado automaticamente.");
      await readyTeam(resolvedTeam, true);
    };
    const delay = timerState.phase === "expired" ? 0 : Math.max(0, selectionTiming.urgencyDeadline - Date.now());
    const timeout = window.setTimeout(autoConfirm, delay);
    return () => window.clearTimeout(timeout);
  }, [battle, mode, myReady, player?.id, selected, selectionTiming]);

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
          const intent = decideCpuIntent(current, { difficulty: mode === "badge-cpu" ? "hard" : current?.cpuDifficulty || cpuDifficulty });
          const next = resolveAction(current, "guest", intent);
          persistBattleConsumables(next, "host");
          return rewardFinishedBattle(current, next, "host");
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
    setMyReady(false);
    setOpponentReady(false);
    clearFriendSelectionTiming();
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
  async function readyTeam(teamToConfirm, automatic = false) {
    if (preparingTeam || myReady) return;
    const requestedTeam = getReadySelection(teamToConfirm, selected);
    setPreparingTeam(true);
    let currentCollection;
    let currentEconomy;
    try {
      [currentCollection, currentEconomy] = await Promise.all([webStore.getData("Pokedex"), webStore.getEconomy()]);
    } catch {
      setNotice("Não foi possível carregar sua equipe atual. Tente novamente.");
      setPreparingTeam(false);
      return;
    }
    const currentTeam = requestedTeam.map((selectedPokemon) => currentCollection.find((pokemon) => String(pokemon.id) === String(selectedPokemon.id))).filter(Boolean);
    if (currentTeam.length !== requestedTeam.length || currentTeam.length !== 3) {
      setNotice("Um Pokémon selecionado não foi encontrado na sua coleção. Monte a equipe novamente.");
      setCollection(currentCollection);
      setSelected(currentTeam);
      setPreparingTeam(false);
      return;
    }
    const invalidAssignments = validateHeldItemAssignments({ economy: currentEconomy, collection: currentCollection });
    if (invalidAssignments.length) {
      setNotice("Há mais itens equipados do que unidades disponíveis. Remova um item antes de batalhar.");
      setCollection(currentCollection);
      setSelected(currentTeam);
      setInventory(currentEconomy.inventory || {});
      setPreparingTeam(false);
      return;
    }
    setCollection(currentCollection);
    setSelected(currentTeam);
    setInventory(currentEconomy.inventory || {});
    const badgeConfig = getBadgeConfig(badgeChallenge?.badge?.code);
    if (badgeConfig) {
      const validation = validateBadgeTeam(currentTeam, badgeConfig.type);
      if (!validation.valid) {
        setNotice(getBadgeTeamErrorMessage(validation, badgeConfig.localizedTypeName));
        setPreparingTeam(false);
        return;
      }
    }
    // CPU path: no multiplayer synchronization needed
    if (["cpu", "badge-cpu"].includes(mode)) {
      const local = makePlayer(name, profile?.playerId);
      setPlayer(local);
      const journeyTeam = mode === "badge-cpu"
        ? getBadgeCpuTeam(badgeConfig.type, badgeChallenge.current_battle)
        : journeyNode ? journeyNode.team.map((entry) => { const rosterEntry = CPU_ROSTER.find((pokemon) => pokemon.id === (entry.id || entry)) || CPU_TEAM[0]; return { ...rosterEntry, level: entry.level || rosterEntry.level }; }) : generateCpuTeam({ difficulty: cpuDifficulty, playerTeam: currentTeam, recentTeams: recentCpuTeams.current });
      if (mode === "cpu" && !journeyNode) recentCpuTeams.current = [...recentCpuTeams.current, journeyTeam].slice(-3);
      await startState(currentTeam, journeyTeam, local, { id: "cpu", name: mode === "badge-cpu" ? badgeConfig.leaderName : journeyNode?.badge ? "Líder do Ginásio" : journeyNode ? journeyNode.title : "CPU", inventory: mode === "badge-cpu" ? {} : createCpuInventory(cpuDifficulty) }, mode === "cpu" ? { difficulty: cpuDifficulty } : null);
      setPreparingTeam(false);
      return;
    }
    // Multiplayer path: publish readiness then WAIT for opponent to also confirm.
    // HOST will start the battle only when BOTH myReady && opponentReady are true (see useEffect above).
    if (!realtime.current?.isConnected()) {
      setNotice("Ainda conectando à sala. Aguarde antes de confirmar.");
      setPreparingTeam(false);
      return;
    }
    const currentInventory = currentEconomy.inventory || {};
    const battleTeam = currentTeam.map(toBattlePokemon);
    const teamPayload = { player: { ...player, inventory: Object.fromEntries(BAG_ITEM_CATALOG.map((item) => [item.id, currentInventory[item.id] || 0])) }, team: battleTeam };
    try {
      // Update Presence so the opponent sees our ready state immediately
      await realtime.current.updatePresence({ ready: true, team: battleTeam });
      // Broadcast explicit READY event with team snapshot (authoritative)
      broadcast(BATTLE_EVENTS.READY, {
        playerId: player.id,
        playerName: player.name,
        ready: true,
        team: battleTeam,
      });
      // Also broadcast TEAM for backward compat with older clients
      broadcast(BATTLE_EVENTS.TEAM, teamPayload);
      setMyReady(true);
      setNotice(automatic ? "Tempo encerrado. Seu time foi confirmado automaticamente." : "PRONTO! Aguardando adversário...");
    } catch (error) { setNotice(error.message); }
    setPreparingTeam(false);
  }
  function unreadyTeam() {
    // Let the player cancel their PRONTO and change their team.
    // Battle cannot start while myReady is false, so no race risk.
    setMyReady(false);
    void realtime.current?.updatePresence({ ready: false, team: null }).catch(() => {});
    broadcast(BATTLE_EVENTS.READY, { playerId: player?.id, ready: false });
    setNotice("Você voltou a selecionar o time.");
  }

  async function ensureFriendEligible() {
    try {
      const currentCollection = await webStore.getData("Pokedex");
      setCollection(currentCollection);
      if (currentCollection.length >= 3) return true;
      setNotice("Capture pelo menos 3 Pokémon antes de entrar em uma batalha PvP.");
      return false;
    } catch {
      setNotice("Não foi possível validar sua coleção agora. Tente novamente.");
      return false;
    }
  }
  async function createRoom(wagerAmount = 0) {
    if (!hasRealtimeConfig()) {
      setNotice(
        "Configure as variáveis do Supabase para jogar contra um amigo.",
      );
      return;
    }
    if (!(await ensureFriendEligible())) return;
    const currentPlayer = makePlayer(name, profile?.playerId);
    setName(currentPlayer.name);
    void webStore.setTrainerName(currentPlayer.name);
    const code = makeCode();
    const amount = normalizeWagerAmount(wagerAmount);
    const offer = amount ? { id: `wager:${code}`, roomCode: code, hostId: currentPlayer.id, amount, status: "PROPOSED" } : null;
    setPlayer(currentPlayer);
    setRole("host");
    setRoomCode(code);
    setMyReady(false);
    setOpponentReady(false);
    wagerSnapshot.current = offer;
    setWager(offer);
    clearFriendSelectionTiming();
    setScreen("team");
    connectRoom(code, currentPlayer, "host", offer);
  }
  async function joinRoom() {
    if (!hasRealtimeConfig()) {
      setNotice(
        "Configure as variáveis do Supabase para jogar contra um amigo.",
      );
      return;
    }
    if (!(await ensureFriendEligible())) return;
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
    setMyReady(false);
    setOpponentReady(false);
    wagerSnapshot.current = null;
    setWager(null);
    clearFriendSelectionTiming();
    setScreen("team");
    connectRoom(code, currentPlayer, "guest");
  }
  async function acceptWager() {
    if (!wager || role !== "guest" || wager.status !== "PROPOSED") return;
    const result = await webStore.reserveWager(wager.id, wager.amount);
    if (!result.ok) { setNotice("Saldo insuficiente para aceitar a aposta."); return; }
    dispatch(actCoins(result.coins));
    setWager((current) => ({ ...current, status: "ACCEPTING" }));
    broadcast(BATTLE_EVENTS.WAGER_ACCEPT, { wager, playerId: player?.id });
  }
  function rejectWager() { if (!wager || role !== "guest") return; broadcast(BATTLE_EVENTS.WAGER_REJECTED, { wagerId: wager.id }); setWager(null); setNotice("Você recusou a aposta. A sala continua sem aposta."); }
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
      setMyReady(false);
      setOpponentReady(false);
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
    const participantIds = [match?.player1_id, match?.player2_id];
    if (!match?.id || !match?.tournament_id || !match?.battle_room_code || !participantIds.includes(profile.playerId)) {
      setNotice("Esta partida do campeonato ainda não está pronta. Atualize a chave e tente novamente.");
      return;
    }
    const currentPlayer = { id: profile.playerId, name: name.trim() || profile.displayName };
    const currentRole = match.player1_id === profile.playerId ? "host" : "guest";
    setMode("tournament"); setTournamentMatch(match); setPlayer(currentPlayer); setRole(currentRole); setRoomCode(match.battle_room_code); setSelected([]); setBattle(null); setMyReady(false); setOpponentReady(false); setScreen("team");
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
        setMyReady(false);
        setOpponentReady(false);
        setBadgeResolution(null);
        setBadgeResultError("");
        setScreen("team");
      }
      return;
    }
    if (mode === "tournament") { realtime.current?.leave(); setBattle(null); setSelected([]); setRemoteTeam(null); setMyReady(false); setOpponentReady(false); setTournamentMatch(null); setScreen("tournament"); void getTournament(tournament?.id).then(setTournament).catch(() => {}); return; }
    if (mode === "friend") {
      broadcast(BATTLE_EVENTS.REMATCH, {});
      setWager(null);
      clearFriendSelectionTiming();
      void realtime.current?.updatePresence({ ready: false, team: null, selectionTiming: null }).catch(() => {});
    }
    setBattle(null);
    setSelected([]);
    setRemoteTeam(null);
    setMyReady(false);
    setOpponentReady(false);
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
              ready={myReady}
              opponentReady={opponentReady}
              wager={wager}
              role={role}
              onAcceptWager={acceptWager}
              onRejectWager={rejectWager}
              onShare={shareRoom}
            />{" "}
            <TeamSelector
              collection={collection}
              selected={selected}
              onToggle={togglePokemon}
              onReady={readyTeam}
              waiting={myReady || preparingTeam}
              preparing={preparingTeam}
              canReady={["cpu", "badge-cpu"].includes(mode) || connection === "CONNECTED"}
              onUseDeck={setSelected}
              selectionTiming={mode === "friend" ? selectionTiming : null}
              opponentReady={opponentReady}
              cpuDifficulty={mode === "cpu" ? getCpuDifficulty(cpuDifficulty) : null}
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
        <BattleDebugPanel
          context={{
            mode,
            tournamentId: tournament?.id,
            matchId: tournamentMatch?.id,
            playerId: player?.id,
            battlePhase: battle?.status,
            teamSize: selected.length,
            opponentPresent: Boolean(remoteTeam?.player),
            realtimeStatus: connection,
          }}
        />
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
  const difficultyConfig = getCpuDifficulty(difficulty);
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
      <aside className={`cpu-difficulty-summary cpu-difficulty-summary--${difficultyConfig.id}`} aria-live="polite">
        <span>{difficultyConfig.id === "easy" ? "🟢" : difficultyConfig.id === "normal" ? "🟡" : "🔴"} {difficultyConfig.label.toUpperCase()}</span>
        <strong>{difficultyConfig.summary}</strong>
        <small>🪙 {difficultyConfig.baseCoins} base · 🎁 item: {difficultyConfig.id === "easy" ? "chance baixa" : difficultyConfig.id === "normal" ? "chance média" : "até Lendário"}</small>
      </aside>
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
  const [wagerAmount, setWagerAmount] = useState(0);
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
        <button type="button" onClick={() => onCreate(wagerAmount)}>
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
      <fieldset className="wager-picker"><legend>APOSTA OPCIONAL</legend><div>{[0, 100, 250, 500].map((amount) => <button type="button" key={amount} className={wagerAmount === amount ? "selected" : ""} onClick={() => setWagerAmount(amount)} aria-pressed={wagerAmount === amount}>{amount ? `🪙 ${amount}` : "Sem aposta"}</button>)}</div><label>Outro valor<input type="number" min="1" step="1" value={wagerAmount || ""} onChange={(event) => setWagerAmount(normalizeWagerAmount(event.target.value))} placeholder="0" /></label></fieldset>
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
  opponentReady,
  onShare,
  wager,
  role,
  onAcceptWager,
  onRejectWager,
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
          Adversário: {opponentReady ? "PRONTO ✓" : connected > 1 ? "selecionando..." : "aguardando..."}
        </small>
      </div>
      <button type="button" onClick={onShare}>
        <Copy size={18} /> Compartilhar
      </button>
      {wager && <section className="wager-status" aria-label="Estado da aposta"><span>{wager.status === "LOCKED" ? "⚔️ APOSTA ACEITA" : "⚔️ DESAFIO VALENDO MOEDAS"}</span><strong>🪙 {wager.amount} cada · pote 🪙 {getWagerPot(wager)}</strong>{role === "guest" && wager.status === "PROPOSED" && <div><button type="button" onClick={onRejectWager}>Recusar</button><button type="button" onClick={onAcceptWager}>Aceitar aposta</button></div>}</section>}
      {notice && <em>{notice}</em>}
    </div>
  );
}
