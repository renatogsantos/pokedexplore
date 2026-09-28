const SOUND_PATH = "/sound-effect";

export const BATTLE_ITEM_SOUND = Object.freeze({
  BAG_ITEM_USED: "power-up",
  HELD_ITEM_CONSUMED: "item-consumed",
});

const audioCache = new Map();

function getAudio(name) {
  if (typeof window === "undefined") return null;
  if (!audioCache.has(name)) {
    const audio = new Audio(`${SOUND_PATH}/${name}.mp3`);
    audio.preload = "auto";
    audioCache.set(name, audio);
  }
  return audioCache.get(name);
}

// Presentation only: catalog metadata determines which successful, authoritative
// item event deserves audio. Names and player-facing copy are never inspected.
export function getItemConsumptionSound({ definition, effect, event } = {}) {
  if (!definition?.consumable) return null;
  if (
    definition.usageType === "BAG" &&
    effect?.kind === "item" &&
    effect?.result?.consumed &&
    effect.itemId === definition.id
  )
    return BATTLE_ITEM_SOUND.BAG_ITEM_USED;
  if (
    definition.usageType === "HELD" &&
    event?.type === "ITEM_CONSUMED" &&
    event.consumed
  )
    return BATTLE_ITEM_SOUND.HELD_ITEM_CONSUMED;
  return null;
}

export function makeBattleAudioEventKey(matchId, eventId, sound) {
  if (!eventId || !sound) return null;
  return `${matchId || "battle"}:${sound}:${eventId}`;
}

export function createBattleAudioEventDeduper() {
  let battleId = null;
  let played = new Set();
  return {
    shouldPlay(matchId, eventId, sound) {
      const nextBattleId = matchId || "battle";
      if (battleId !== nextBattleId) {
        battleId = nextBattleId;
        played = new Set();
      }
      const key = makeBattleAudioEventKey(nextBattleId, eventId, sound);
      if (!key || played.has(key)) return false;
      played.add(key);
      return true;
    },
  };
}

export function preloadBattleSounds() {
  if (typeof window === "undefined") return;
  Object.values(BATTLE_ITEM_SOUND).forEach((name) => {
    const audio = getAudio(name);
    try {
      audio?.load();
    } catch {
      // A failed preload is never allowed to affect battle initialization.
    }
  });
}

export function getDamageReactionSound(pokemon) {
  const types = Array.isArray(pokemon?.types)
    ? pokemon.types.map((type) => typeof type === "string" ? type : type?.type?.name || type?.name)
    : [pokemon?.type];
  return types.some((type) => String(type).toLowerCase() === "fairy") ? "anime-ahh" : "dano";
}

export function playBattleSound(name, volume = 0.55) {
  const audio = getAudio(name);
  if (!audio) return;
  try {
    audio.currentTime = 0;
    audio.volume = volume;
    audio.play().catch(() => {
      // Navegadores podem bloquear áudio até a primeira interação do usuário.
    });
  } catch {
    // Audio is presentation only; an unavailable asset must not affect battle.
  }
}
