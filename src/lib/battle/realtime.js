import { createClient } from "@supabase/supabase-js";
import {
  PVP_CONNECTION,
  getPvpChannelTopic,
  getSubscribeConnectionState,
  isTrackSuccessful,
  normalizePvpRoomCode,
} from "@/lib/battle/pvpConnection";

export const BATTLE_EVENTS = Object.freeze({ TEAM: "team_ready", READY: "player_ready", START: "battle_start", STATE: "battle_state", ACTION: "battle_action", REMATCH: "rematch_request", BADGE_ERROR: "badge_team_error", WAGER_PROPOSAL: "wager_proposal", WAGER_ACCEPT: "wager_accept", WAGER_LOCKED: "wager_locked", WAGER_REJECTED: "wager_rejected", SELECTION_TIMER: "selection_timer" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const debug = (...args) => { if (process.env.NODE_ENV !== "production") console.debug("[PVP CHANNEL]", ...args); };
let channelSequence = 0;
export const PVP_PROTOCOL_VERSION = 2;

export function hasRealtimeConfig() { return Boolean(url && key); }

/** Owns one browser client/channel for one room session. An inactive session
 * cannot publish an old callback into the current room UI. */
export function createBattleRoom(roomCode, player, handlers = {}) {
  if (!hasRealtimeConfig()) throw new Error("Supabase Realtime não está configurado.");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const normalizedRoomCode = normalizePvpRoomCode(roomCode);
  const topic = getPvpChannelTopic(normalizedRoomCode);
  const instanceId = `pvp-channel-${++channelSequence}-${createUuid()}`;
  let subscribed = false;
  let active = true;
  let trackCount = 0;
  let localPresence = { ready: false, team: null, sessionId: instanceId };
  let pendingTrack = Promise.resolve();
  let lastTracked = null;
  let connectionTimer;
  let hostTimer;
  let hostPresent = false;
  let subscriptionGeneration = 0;
  const armDeadline = () => {
    clearTimeout(connectionTimer);
    connectionTimer = setTimeout(() => {
      if (active) publishStatus(PVP_CONNECTION.ERROR, { reason: "CONNECTION_TIMEOUT", error: "A sala não respondeu a tempo. Tente novamente." });
    }, 15000);
  };
  const emitDiagnostic = (event, detail = {}) => handlers.onDiagnostic?.({ event, timestamp: Date.now(), instanceId, roomCode: normalizedRoomCode, topic, playerId: player.id, ...detail });
  const channel = client.channel(topic, { config: { presence: { key: String(player.id) }, broadcast: { self: false } } });
  const publishStatus = (state, detail = {}) => {
    if (active) handlers.onStatus?.(state, { instanceId, roomCode: normalizedRoomCode, topic, ...detail });
  };
  const syncPresence = () => {
    if (!active) return;
    const presence = channel.presenceState();
    hostPresent = Object.values(presence).flat().some(entry => entry?.id !== player.id && entry?.role === "host");
    if (hostPresent) clearTimeout(hostTimer);
    debug("PRESENCE_SYNC", { instanceId, presence });
    emitDiagnostic("PRESENCE_SYNC", { rawPresenceCount: Object.values(presence).flat().length });
    handlers.onPresence?.(presence);
  };
  const trackPresence = (state = {}) => {
    if (!active || !subscribed) return Promise.reject(new Error("Canal ainda não está conectado."));
    localPresence = { ...localPresence, ...state };
    const content = JSON.stringify({ ...player, ...localPresence });
    const generation = subscriptionGeneration;
    const snapshot = { ...player, ...localPresence, presenceUpdatedAt: Date.now() };
    trackCount += 1;
    emitDiagnostic("TRACK_START", { trackCount });
    const request = pendingTrack.catch(() => {}).then(() => {
      if (!active || !subscribed || generation !== subscriptionGeneration) throw new Error("Canal não está mais conectado.");
      if (lastTracked === content) return "ok";
      return channel.track(snapshot).then(result => { if (generation === subscriptionGeneration && isTrackSuccessful(result)) lastTracked = content; return result; });
    });
    pendingTrack = request;
    return request
      .then((result) => {
        if (!isTrackSuccessful(result)) throw new Error(`Presence track falhou: ${String(result)}`);
        emitDiagnostic("TRACK_OK", { trackCount });
        return result;
      })
      .catch((error) => {
        emitDiagnostic("TRACK_ERROR", { trackCount, error: error?.message || String(error) });
        if (generation === subscriptionGeneration) publishStatus(PVP_CONNECTION.ERROR, { reason: "TRACK_FAILED", error: error?.message || String(error) });
        throw error;
      });
  };
  const send = (payload) => {
    if (!active || !subscribed) return Promise.reject(new Error("Canal ainda não está conectado."));
    emitDiagnostic("EVENT_SENT", { type: payload?.type || null });
    return channel.send({ type: "broadcast", event: "battle", payload: { ...payload, protocolVersion: PVP_PROTOCOL_VERSION, roomId: normalizedRoomCode, senderPlayerId: player.id } })
      .then(result => { if (result !== "ok") throw new Error("Não foi possível sincronizar a sala. Tente novamente."); return result; });
  };
  emitDiagnostic("CHANNEL_CREATE");
  channel.on("broadcast", { event: "battle" }, ({ payload }) => {
    if (!active) return;
    if (payload?.protocolVersion !== PVP_PROTOCOL_VERSION || payload?.roomId !== normalizedRoomCode) {
      emitDiagnostic("PROTOCOL_REJECTED");
      publishStatus(PVP_CONNECTION.ERROR, { reason: "PROTOCOL_MISMATCH", error: "Os jogadores precisam atualizar o jogo para a mesma versão." });
      return;
    }
    if (payload.senderPlayerId === player.id) return;
    emitDiagnostic("EVENT_RECEIVED", { type: payload?.type || null });
    if (payload.type === "state_request") handlers.onStateRequest?.(payload.senderPlayerId);
    else handlers.onEvent?.(payload);
  });
  channel.on("presence", { event: "sync" }, syncPresence);
  channel.on("presence", { event: "join" }, ({ key: presenceKey }) => { if (!active) return; emitDiagnostic("PRESENCE_JOIN", { presenceKey }); syncPresence(); });
  channel.on("presence", { event: "leave" }, ({ key: presenceKey }) => { if (!active) return; emitDiagnostic("PRESENCE_LEAVE", { presenceKey }); syncPresence(); });
  emitDiagnostic("SUBSCRIBE_START");
  armDeadline();
  channel.subscribe((status) => {
    if (!active) return;
    subscribed = status === "SUBSCRIBED";
    const generation = ++subscriptionGeneration;
    // A previous transport's unresolved track cannot own the new queue.
    pendingTrack = Promise.resolve();
    lastTracked = null;
    armDeadline();
    const state = getSubscribeConnectionState(status);
    debug("SUBSCRIBE_STATUS", { instanceId, status, topic });
    emitDiagnostic("SUBSCRIBE_STATUS", { status });
    publishStatus(state, { status });
    if (subscribed) {
      publishStatus(PVP_CONNECTION.PRESENCE_SYNCING, { status });
      void trackPresence().then(() => {
        if (!active || !subscribed || generation !== subscriptionGeneration) return;
        clearTimeout(connectionTimer);
        publishStatus(PVP_CONNECTION.CONNECTED, { status: "TRACKED" });
        if (player.role === "guest" && !hostPresent) {
          clearTimeout(hostTimer);
          hostTimer = setTimeout(() => {
            if (active && !hostPresent) publishStatus(PVP_CONNECTION.ERROR, { reason: "HOST_NOT_PRESENT", error: "O anfitrião não foi encontrado. Confira o código da sala e tente novamente." });
          }, 15000);
        }
        void send({ type: "state_request", payload: null }).catch(error => publishStatus(PVP_CONNECTION.ERROR, { error: error.message }));
      }).catch(() => {});
    }
  });
  return {
    isConnected: () => subscribed && active,
    instanceId,
    topic,
    updatePresence: trackPresence,
    send,
    leave: () => {
      if (!active) return Promise.resolve();
      emitDiagnostic("CHANNEL_CLEANUP", { trackCount });
      active = false;
      subscribed = false;
      clearTimeout(connectionTimer);
      clearTimeout(hostTimer);
      return client.removeChannel(channel);
    },
  };
}

import { createUuid } from "@/lib/runtime/uuid";
