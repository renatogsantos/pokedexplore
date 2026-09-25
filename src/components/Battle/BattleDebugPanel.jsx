"use client";

import { useEffect, useState } from "react";

const isDebugEnabled = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugBattle") === "1";
const describeError = (value) => {
  const error = value instanceof Error ? value : new Error(String(value || "Erro desconhecido"));
  return { name: error.name || "Error", message: error.message || "Erro sem mensagem", stack: error.stack || "Stack indisponível" };
};

/** Deliberately opt-in diagnostics for errors that are otherwise hard to inspect on a phone. */
export default function BattleDebugPanel({ context = {} }) {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!isDebugEnabled()) return undefined;
    setEnabled(true);
    const onError = (event) => setError(describeError(event.error || event.message));
    const onRejection = (event) => setError(describeError(event.reason));
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  if (!enabled) return null;
  const safeContext = {
    route: typeof window === "undefined" ? "/batalha" : window.location.pathname,
    battleMode: context.mode || null,
    tournamentId: context.tournamentId || null,
    matchId: context.matchId || null,
    playerPresent: Boolean(context.playerId),
    battlePhase: context.battlePhase || null,
    teamSize: Number(context.teamSize || 0),
    opponentPresent: Boolean(context.opponentPresent),
    realtimeStatus: context.realtimeStatus || null,
  };
  return <aside className="battle-debug-panel" role="alert" aria-live="assertive"><strong>DEBUG BATTLE</strong><pre>{JSON.stringify({ error, context: safeContext }, null, 2)}</pre></aside>;
}
