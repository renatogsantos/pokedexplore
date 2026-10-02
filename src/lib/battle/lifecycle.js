// A derived lifecycle keeps the existing screen adapters while giving each
// visible waiting state a canonical explanation. CPU never reads connection.
export function getMatchLifecycle({ screen, mode, localData = "ready", preparing, connection, ready, peerPresent, battle, starting, error }) {
  if (error) return { state: "ERROR", reason: error };
  if (battle) return { state: battle.status === "finished" ? "COMPLETED" : battle.status === "countdown" ? "INITIALIZING_BATTLE" : "BATTLE_ACTIVE", reason: battle.status };
  if (localData !== "ready") return { state: "LOADING_LOCAL_DATA", reason: localData };
  if (starting) return { state: "INITIALIZING_BATTLE", reason: "HOST_INITIALIZATION" };
  if (preparing) return { state: "PREPARING_MATCH", reason: "LOCAL_SNAPSHOT" };
  if (screen !== "team") return { state: "IDLE", reason: screen };
  const multiplayer = ["friend", "badge-pvp", "tournament-pvp"].includes(mode);
  if (multiplayer && ["ERROR", "CLOSED"].includes(connection)) return { state: "ERROR", reason: connection };
  if (multiplayer && connection !== "CONNECTED") return { state: "CONNECTING", reason: connection };
  if (multiplayer && !peerPresent) return { state: "WAITING_FOR_OPPONENT", reason: "PEER_ABSENT" };
  return { state: ready ? "WAITING_FOR_READY" : "SELECTING_TEAM", reason: ready ? "REMOTE_READY" : "LOCAL_SELECTION" };
}

export async function withPreparationDeadline(operation, milliseconds = 15000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Não foi possível preparar a batalha a tempo. Tente novamente.")), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
