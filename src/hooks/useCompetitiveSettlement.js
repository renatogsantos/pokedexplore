"use client";
import { useEffect, useState } from "react";
import { webStore } from "@/helpers/webStore";
import { buildCompetitiveResult } from "@/lib/ranking/results";
import { flushCompetitiveResults } from "@/lib/ranking/sync";

export default function useCompetitiveSettlement(state, role, mode, journey) {
  const [settlement, setSettlement] = useState(null);
  const playerId = state[role]?.id;
  const event = buildCompetitiveResult({ state, role, playerId, mode, journey });
  useEffect(() => {
    if (!event) return;
    let active = true;
    const matches = detail => detail?.matchId === state.matchId && detail?.playerId === playerId;
    const confirmed = ({ detail }) => { if (active && matches(detail)) setSettlement({ ...detail, status: "settled" }); };
    const failed = ({ detail }) => { if (active && matches(detail)) setSettlement({ ...detail, status: "error" }); };
    window.addEventListener("competitive-settlement", confirmed);
    window.addEventListener("competitive-settlement-error", failed);
    void webStore.getCompetitiveSettlement(playerId, state.matchId).then(saved => {
      if (active && saved) setSettlement({ ...saved, status: "settled" });
    }).catch(() => { if (active) setSettlement({ playerId, matchId: state.matchId, status: "error" }); });
    return () => { active = false; window.removeEventListener("competitive-settlement", confirmed); window.removeEventListener("competitive-settlement-error", failed); };
  }, [state.matchId, state.status, playerId, role, mode, journey]);
  const current = event && settlement?.matchId === state.matchId && settlement?.playerId === playerId ? settlement : null;
  const retry = () => {
    if (!event) return;
    setSettlement({ playerId, matchId: state.matchId, status: "pending" });
    void webStore.enqueueCompetitiveResult(event).then(flushCompetitiveResults).catch(() => {
      setSettlement({ playerId, matchId: state.matchId, status: "error" });
    });
  };
  return { eligible: Boolean(event), status: current?.status || "pending", masterBonus: current?.masterBonus || 0, retry };
}
