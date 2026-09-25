"use client";

import { useCallback, useEffect, useState } from "react";
import { webStore } from "@/helpers/webStore";
import { selectBadgeProfile, selectLocalTrainerProfile } from "@/lib/profile/selectors";
import { isValidPlayerAvatarId } from "@/lib/profile/avatars";

export default function useTrainerProfile() {
  const [local, setLocal] = useState(null);
  const [competitive, setCompetitive] = useState(null);
  const [localLoading, setLocalLoading] = useState(true);
  const [competitiveLoading, setCompetitiveLoading] = useState(true);
  const [competitiveError, setCompetitiveError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const loadLocal = useCallback(async () => {
    setLocalLoading(true);
    const { identity, collection, economy, decks } = await webStore.getTrainerProfileSnapshot();
    const next = selectLocalTrainerProfile({ identity, collection, economy, decks });
    setLocal(next);
    setLocalLoading(false);
    return next;
  }, []);

  const loadCompetitive = useCallback(async (identity) => {
    const badgeService = await import("@/lib/badges/service");
    if (!identity?.playerId || !badgeService.hasBadgeServiceConfig()) {
      setCompetitive(null);
      setCompetitiveError("As informações competitivas estão indisponíveis neste ambiente.");
      setCompetitiveLoading(false);
      return;
    }
    setCompetitiveLoading(true);
    setCompetitiveError("");
    try {
      const remote = await badgeService.getPlayerBadgeProfile(identity.playerId);
      setCompetitive(selectBadgeProfile(remote, identity.playerId));
    } catch (error) {
      if (process.env.NODE_ENV !== "production") console.error("[Profile] competitive data failed", error);
      setCompetitiveError("Não foi possível carregar as informações competitivas.");
    } finally {
      setCompetitiveLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe;
    void loadLocal().then((nextLocal) => {
      if (!active) return;
      void import("@/lib/badges/service").then((badgeService) => {
        if (!active) return;
        if (!badgeService.hasBadgeServiceConfig()) return loadCompetitive(nextLocal.identity);
        void badgeService.registerCompetitivePlayer(nextLocal.identity)
          .then(() => loadCompetitive(nextLocal.identity))
          .catch(() => loadCompetitive(nextLocal.identity));
        unsubscribe = badgeService.subscribeBadges(() => { void loadCompetitive(nextLocal.identity); });
      });
    });
    return () => { active = false; unsubscribe?.(); };
  }, [loadCompetitive, loadLocal]);

  const retryCompetitive = useCallback(() => {
    if (local?.identity) void loadCompetitive(local.identity);
  }, [loadCompetitive, local?.identity]);

  const saveProfile = useCallback(async ({ displayName: requestedName, avatarId }) => {
    const displayName = String(requestedName || "").trim().slice(0, 18);
    if (!displayName) throw new Error("Digite um nome para o treinador.");
    if (!isValidPlayerAvatarId(avatarId)) throw new Error("Escolha um avatar válido.");
    setSavingProfile(true);
    try {
      const previousName = local?.identity?.displayName;
      const identity = await webStore.setLocalPlayerProfile({ ...local.identity, displayName, avatarId });
      setLocal((current) => ({ ...current, identity }));
      const badgeService = await import("@/lib/badges/service");
      if (badgeService.hasBadgeServiceConfig() && displayName !== previousName) {
        try {
          await badgeService.registerCompetitivePlayer(identity);
          await loadCompetitive(identity);
        } catch {
          setCompetitiveError("O nome foi salvo neste dispositivo, mas não pôde ser sincronizado agora.");
        }
      }
      return identity;
    } finally {
      setSavingProfile(false);
    }
  }, [loadCompetitive, local?.identity]);

  return {
    local,
    competitive,
    localLoading,
    competitiveLoading,
    competitiveError,
    savingProfile,
    retryCompetitive,
    saveProfile,
  };
}
