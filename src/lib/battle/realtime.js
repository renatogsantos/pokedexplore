import { createClient } from "@supabase/supabase-js";

export const BATTLE_EVENTS = Object.freeze({ JOINED: "player_joined", TEAM: "team_ready", STATE: "battle_state", ACTION: "battle_action", REMATCH: "rematch_request", REMATCH_ACCEPT: "rematch_accept" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function hasRealtimeConfig() { return Boolean(url && key); }

export function createBattleRoom(roomCode, player, handlers) {
  if (!hasRealtimeConfig()) throw new Error("Supabase não configurado");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const channel = client.channel(`battle:${roomCode}`, { config: { presence: { key: player.id }, broadcast: { self: false } } });
  channel.on("broadcast", { event: "battle" }, ({ payload }) => handlers.onEvent?.(payload));
  channel.on("presence", { event: "sync" }, () => handlers.onPresence?.(channel.presenceState()));
  channel.subscribe((status) => {
    handlers.onStatus?.(status);
    if (status === "SUBSCRIBED") channel.track(player);
  });
  return { send: (payload) => channel.send({ type: "broadcast", event: "battle", payload }), leave: () => client.removeChannel(channel) };
}
