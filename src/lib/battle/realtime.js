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

export function hasRealtimeConfig() { return Boolean(url && key); }

/** Owns one browser client/channel for one room session. An inactive session
 * cannot publish an old callback into the current room UI. */
export function createBattleRoom(roomCode, player, handlers = {}) {
  if (!hasRealtimeConfig()) throw new Error("Supabase Realtime não está configurado.");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const normalizedRoomCode = normalizePvpRoomCode(roomCode);
  const topic = getPvpChannelTopic(normalizedRoomCode);
  const instanceId = `pvp-channel-${++channelSequence}`;
  let subscribed = false;
  let active = true;
  let trackCount = 0;
  const emitDiagnostic = (event, detail = {}) => handlers.onDiagnostic?.({ event, timestamp: Date.now(), instanceId, roomCode: normalizedRoomCode, topic, playerId: player.id, ...detail });
  const channel = client.channel(topic, { config: { presence: { key: String(player.id) }, broadcast: { self: false } } });
  const publishStatus = (state, detail = {}) => {
    if (active) handlers.onStatus?.(state, { instanceId, roomCode: normalizedRoomCode, topic, ...detail });
  };
  const syncPresence = () => {
    if (!active) return;
    const presence = channel.presenceState();
    debug("PRESENCE_SYNC", { instanceId, presence });
    emitDiagnostic("PRESENCE_SYNC", { rawPresenceCount: Object.values(presence).flat().length });
    handlers.onPresence?.(presence);
  };
  const trackPresence = (state = {}) => {
    if (!active || !subscribed) return Promise.reject(new Error("Canal ainda não está conectado."));
    trackCount += 1;
    emitDiagnostic("TRACK_START", { trackCount });
    return Promise.resolve(channel.track({ ...player, ...state, presenceUpdatedAt: Date.now() }))
      .then((result) => {
        if (!isTrackSuccessful(result)) throw new Error(`Presence track falhou: ${String(result)}`);
        emitDiagnostic("TRACK_OK", { trackCount });
        return result;
      })
      .catch((error) => {
        emitDiagnostic("TRACK_ERROR", { trackCount, error: error?.message || String(error) });
        publishStatus(PVP_CONNECTION.ERROR, { reason: "TRACK_FAILED", error: error?.message || String(error) });
        throw error;
      });
  };
  emitDiagnostic("CHANNEL_CREATE");
  channel.on("broadcast", { event: "battle" }, ({ payload }) => { if (!active) return; emitDiagnostic("EVENT_RECEIVED", { type: payload?.type || null }); handlers.onEvent?.(payload); });
  channel.on("presence", { event: "sync" }, syncPresence);
  channel.on("presence", { event: "join" }, ({ key: presenceKey }) => { if (!active) return; emitDiagnostic("PRESENCE_JOIN", { presenceKey }); syncPresence(); });
  channel.on("presence", { event: "leave" }, ({ key: presenceKey }) => { if (!active) return; emitDiagnostic("PRESENCE_LEAVE", { presenceKey }); syncPresence(); });
  emitDiagnostic("SUBSCRIBE_START");
  channel.subscribe((status) => {
    if (!active) return;
    subscribed = status === "SUBSCRIBED";
    const state = getSubscribeConnectionState(status);
    debug("SUBSCRIBE_STATUS", { instanceId, status, topic });
    emitDiagnostic("SUBSCRIBE_STATUS", { status });
    publishStatus(state, { status });
    if (subscribed) {
      publishStatus(PVP_CONNECTION.PRESENCE_SYNCING, { status });
      void trackPresence({ ready: false }).then(() => publishStatus(PVP_CONNECTION.CONNECTED, { status: "TRACKED" })).catch(() => {});
    }
  });
  return {
    isConnected: () => subscribed && active,
    instanceId,
    topic,
    updatePresence: trackPresence,
    send: (payload) => {
      if (!active || !subscribed) return Promise.reject(new Error("Canal ainda não está conectado."));
      emitDiagnostic("EVENT_SENT", { type: payload?.type || null });
      return channel.send({ type: "broadcast", event: "battle", payload });
    },
    leave: () => {
      if (!active) return Promise.resolve();
      emitDiagnostic("CHANNEL_CLEANUP", { trackCount });
      active = false;
      subscribed = false;
      return client.removeChannel(channel);
    },
  };
}
