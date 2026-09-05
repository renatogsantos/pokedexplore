import { createClient } from "@supabase/supabase-js";

export const BATTLE_EVENTS = Object.freeze({ TEAM: "team_ready", START: "battle_start", STATE: "battle_state", ACTION: "battle_action", REMATCH: "rematch_request" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const debug = (...args) => { if (process.env.NODE_ENV !== "production") console.debug("[Battle Realtime]", ...args); };

export function hasRealtimeConfig() { return Boolean(url && key); }

export function createBattleRoom(roomCode, player, handlers) {
  if (!hasRealtimeConfig()) throw new Error("Supabase Realtime não está configurado.");
  const client = createClient(url, key, { auth: { persistSession: false } });
  let subscribed = false;
  const channel = client.channel(`battle:${roomCode}`, { config: { presence: { key: player.id }, broadcast: { self: false } } });
  const syncPresence = () => { const presence = channel.presenceState(); debug("presence synced", presence); handlers.onPresence?.(presence); };
  channel.on("broadcast", { event: "battle" }, ({ payload }) => { debug("event received", payload?.type); handlers.onEvent?.(payload); });
  channel.on("presence", { event: "sync" }, syncPresence);
  channel.on("presence", { event: "join" }, ({ key: presenceKey }) => { debug("player joined", presenceKey); syncPresence(); });
  channel.on("presence", { event: "leave" }, ({ key: presenceKey }) => { debug("player left", presenceKey); syncPresence(); });
  channel.subscribe((status) => {
    debug("channel status", status);
    subscribed = status === "SUBSCRIBED";
    handlers.onStatus?.(status);
    if (subscribed) {
      debug("channel subscribed");
      channel.track({ ...player, ready: false });
    }
  });
  return {
    isConnected: () => subscribed,
    updatePresence: (state) => subscribed ? channel.track({ ...player, ...state }) : Promise.reject(new Error("Canal ainda não está conectado.")),
    send: (payload) => {
      if (!subscribed) return Promise.reject(new Error("Canal ainda não está conectado."));
      debug("event sent", payload?.type);
      return channel.send({ type: "broadcast", event: "battle", payload });
    },
    leave: () => client.removeChannel(channel),
  };
}
