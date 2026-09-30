export const PVP_CONNECTION = Object.freeze({
  IDLE: "IDLE",
  CONNECTING: "CONNECTING",
  SUBSCRIBED: "SUBSCRIBED",
  PRESENCE_SYNCING: "PRESENCE_SYNCING",
  CONNECTED: "CONNECTED",
  RECONNECTING: "RECONNECTING",
  ERROR: "ERROR",
  CLOSED: "CLOSED",
});

export function normalizePvpRoomCode(roomCode) {
  return String(roomCode || "").trim().toUpperCase();
}

export function getPvpChannelTopic(roomCode) {
  return `battle:${normalizePvpRoomCode(roomCode)}`;
}

export function getSubscribeConnectionState(status) {
  if (status === "SUBSCRIBED") return PVP_CONNECTION.SUBSCRIBED;
  if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") return PVP_CONNECTION.ERROR;
  if (status === "CLOSED") return PVP_CONNECTION.CLOSED;
  return PVP_CONNECTION.CONNECTING;
}

export function getPvpConnectionMessage(state) {
  if (state === PVP_CONNECTION.CONNECTED) return "Conectado à sala. Selecione sua equipe.";
  if (state === PVP_CONNECTION.RECONNECTING) return "Reconectando à sala...";
  if (state === PVP_CONNECTION.ERROR) return "Não foi possível conectar à sala. Tente novamente.";
  if (state === PVP_CONNECTION.CLOSED) return "Conexão com a sala encerrada.";
  if (state === PVP_CONNECTION.PRESENCE_SYNCING || state === PVP_CONNECTION.SUBSCRIBED) return "Sincronizando presença na sala...";
  return "Conectando à sala...";
}

export function isTrackSuccessful(result) {
  return result === "ok" || result?.status === "ok" || result?.status === "OK";
}
