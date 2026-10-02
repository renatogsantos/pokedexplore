const events = [];
export function traceBattleStart(stage, details = {}) {
  if (process.env.NODE_ENV === "production") return;
  const event = { stage, at: typeof performance === "undefined" ? Date.now() : performance.now(), ...details };
  events.push(event); if (events.length > 80) events.shift();
  console.debug("[BATTLE_START]", event);
}
export function traceBattleStartError(stage, error, details = {}) {
  traceBattleStart(stage, { ...details, errorName: error?.name, errorMessage: error?.message, stack: error?.stack });
}
