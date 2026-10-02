import { webStore } from "@/helpers/webStore";
import { hasRankingConfig, submitCompetitiveResult, syncRankingProfile } from "./service";
import { POKEMON_MASTER_TITLE } from "@/lib/profile/pokemonMaster";

let running;
let requested = false;
// A durable outbox survives refresh/offline; SQL + the IndexedDB receipt transaction
// also handle separate tabs, where this in-memory lock is intentionally insufficient.
export function flushCompetitiveResults() {
  if (!hasRankingConfig()) return Promise.resolve();
  requested = true;
  if (running) return running;
  running = (async () => {
    do {
      requested = false;
      const profile = await webStore.getLocalPlayerProfile();
      try {
        const publicProfile = await syncRankingProfile(profile);
        await webStore.recordPokemonMasterState(profile.playerId, publicProfile?.title === POKEMON_MASTER_TITLE);
      }
      catch (error) {
        for (const { event } of await webStore.getPendingCompetitiveResults(profile.playerId)) {
          window.dispatchEvent(new CustomEvent("competitive-settlement-error", { detail: { playerId: event.playerId, matchId: event.matchId } }));
        }
        throw error;
      }
      const pending = await webStore.getPendingCompetitiveResults(profile.playerId);
      let failures = 0;
      for (const { event } of pending) {
        try {
          const response = await submitCompetitiveResult(event);
          const result = await webStore.applyCompetitiveSettlement(event, response);
          if (result.ownerChanged) break;
          window.dispatchEvent(new CustomEvent("competitive-settlement", { detail: result }));
        } catch (error) {
          failures++;
          window.dispatchEvent(new CustomEvent("competitive-settlement-error", { detail: { playerId: event.playerId, matchId: event.matchId } }));
          if (process.env.NODE_ENV !== "production") console.warn("[Ranking] Result remains in outbox", error?.code || error?.message);
        }
      }
      if (pending.length === 30 && !failures) requested = true;
    } while (requested);
  })().finally(() => { running = null; });
  return running;
}
