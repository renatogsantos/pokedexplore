import { getHeldItemInventoryId } from "@/lib/economy/heldItems";

const latestPresence = (entries) => [...entries].sort((left, right) =>
  Number(right?.presenceUpdatedAt || right?.readyAt || right?.online_at || 0) - Number(left?.presenceUpdatedAt || left?.readyAt || left?.online_at || 0),
)[0];

/** Presence may contain multiple metas for a reconnecting client. PvP has one
 * logical participant per stable player id, never one per Presence meta. */
export function getLogicalPresencePlayers(presence = {}) {
  const byPlayerId = new Map();
  Object.values(presence).flat().forEach((entry) => {
    if (!entry?.id) return;
    const key = String(entry.id);
    byPlayerId.set(key, [...(byPlayerId.get(key) || []), entry]);
  });
  return [...byPlayerId.values()].map(latestPresence).filter(Boolean);
}

export function validatePvpTeam(team) {
  if (!Array.isArray(team)) return { valid: false, reason: "SERIALIZATION_ERROR" };
  if (team.length !== 3) return { valid: false, reason: "TEAM_SIZE", teamSize: team.length };
  const ids = new Set();
  for (const pokemon of team) {
    const instanceId = pokemon?.instanceId ?? pokemon?.id;
    if (instanceId === null || instanceId === undefined || instanceId === "") return { valid: false, reason: "MISSING_INSTANCE_ID" };
    if (ids.has(String(instanceId))) return { valid: false, reason: "DUPLICATE_INSTANCE", pokemonId: instanceId };
    ids.add(String(instanceId));
    if (!pokemon?.name) return { valid: false, reason: "INVALID_POKEMON", pokemonId: instanceId };
    if (!Number.isFinite(Number(pokemon.level)) || Number(pokemon.level) < 1) return { valid: false, reason: "INVALID_LEVEL", pokemonId: instanceId };
    const strategic = pokemon.strategicItem ?? pokemon.strategicItemId ?? pokemon.heldItem ?? null;
    const relic = pokemon.elementalRelic ?? pokemon.elementalRelicId ?? null;
    if (strategic && !getHeldItemInventoryId(strategic)) return { valid: false, reason: "INVALID_ITEM", pokemonId: instanceId, field: "strategicItem" };
    if (relic && !getHeldItemInventoryId(relic)) return { valid: false, reason: "INVALID_RELIC", pokemonId: instanceId, field: "elementalRelic" };
  }
  return { valid: true, reason: null, teamSize: team.length };
}

export function getPvpStartBlocker({ channelStatus, isHost, hostReady, guestReady, hostTeam, guestTeam, matchStatus = "LOBBY" }) {
  if (channelStatus !== "CONNECTED") return "CHANNEL_NOT_READY";
  if (!isHost) return "WAITING_FOR_HOST";
  if (matchStatus !== "LOBBY") return "ALREADY_STARTING";
  const hostValidation = validatePvpTeam(hostTeam);
  const guestValidation = validatePvpTeam(guestTeam);
  if (!hostValidation.valid) return hostValidation.reason === "TEAM_SIZE" ? "HOST_TEAM_INCOMPLETE" : "HOST_TEAM_INVALID";
  if (!guestValidation.valid) return guestValidation.reason === "TEAM_SIZE" ? "GUEST_TEAM_INCOMPLETE" : "GUEST_TEAM_INVALID";
  if (!hostReady) return "HOST_NOT_READY";
  if (!guestReady) return "GUEST_NOT_READY";
  return null;
}

export function getPvpStartSnapshot(input) {
  const blocker = getPvpStartBlocker(input);
  return { canStart: blocker === null, blocker, hostTeam: validatePvpTeam(input.hostTeam), guestTeam: validatePvpTeam(input.guestTeam) };
}
