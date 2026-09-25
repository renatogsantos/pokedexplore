export const WAGER_PRESETS = Object.freeze([0, 100, 250, 500]);

export function normalizeWagerAmount(value) {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : 0;
}

export function getWagerPot(wager) {
  return normalizeWagerAmount(wager?.amount) * 2;
}

export function canStartWagerBattle(wager) {
  return !wager || wager.status === "LOCKED";
}
