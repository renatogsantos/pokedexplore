import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const CREATOR_SESSION_COOKIE = "pokedexplore_creator_session";
export const CREATOR_SESSION_MAX_AGE = 60 * 60 * 8;

export function getCreatorSecret() {
  return String(process.env.CREATOR_CONTROL_SECRET || "").trim();
}

export function isCreatorProtectionConfigured() {
  return getCreatorSecret().length >= 16;
}

function signature(value, secret = getCreatorSecret()) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function isCreatorPassphraseValid(passphrase) {
  const secret = getCreatorSecret();
  return isCreatorProtectionConfigured() && safeEqual(String(passphrase || ""), secret);
}

export function createCreatorSessionToken(now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ expiresAt: now + CREATOR_SESSION_MAX_AGE * 1000 })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function isCreatorSessionTokenValid(token, now = Date.now()) {
  if (!isCreatorProtectionConfigured()) return false;
  const [payload, providedSignature, ...rest] = String(token || "").split(".");
  if (!payload || !providedSignature || rest.length || !safeEqual(providedSignature, signature(payload))) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number.isFinite(parsed.expiresAt) && parsed.expiresAt > now;
  } catch {
    return false;
  }
}

export function isCreatorAuthorized() {
  return isCreatorSessionTokenValid(cookies().get(CREATOR_SESSION_COOKIE)?.value);
}
