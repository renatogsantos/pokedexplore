const SOUND_PATH = "/sound-effect";

export const BATTLE_ITEM_SOUND = Object.freeze({
  BAG_ITEM_USED: "power-up",
  HELD_ITEM_CONSUMED: "item-consumed",
});

export const BATTLE_EVENT_SOUND = Object.freeze({
  START_BATTLE: "start-battle",
  FINISH_HIM: "finish-him",
  BRUTALITY: "brutality",
  VICTORY: "win",
  DEFEAT: "lost",
  ROUND_ONE: "round-one",
  ROUND_TWO: "round-two",
  FINAL_ROUND: "final-round",
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
  [...Object.values(BATTLE_ITEM_SOUND), ...Object.values(BATTLE_EVENT_SOUND)].forEach((name) => {
    const audio = getAudio(name);
    try {
      audio?.load();
    } catch {
      // A failed preload is never allowed to affect battle initialization.
    }
  });
}

export function getBadgeRoundSound(mode, battleNumber) {
  if (!["badge-cpu", "badge-pvp"].includes(mode)) return null;
  return {
    1: BATTLE_EVENT_SOUND.ROUND_ONE,
    2: BATTLE_EVENT_SOUND.ROUND_TWO,
    3: BATTLE_EVENT_SOUND.FINAL_ROUND,
  }[Number(battleNumber)] || null;
}

export function getRoundStartSound(battleNumber) {
  return {
    1: BATTLE_EVENT_SOUND.ROUND_ONE,
    2: BATTLE_EVENT_SOUND.ROUND_TWO,
    3: BATTLE_EVENT_SOUND.FINAL_ROUND,
  }[Number(battleNumber)] || null;
}

function getLivingPokemon(team = []) {
  return team.filter((pokemon) => Number(pokemon?.hp) > 0);
}

// The finished engine state is the single authority for a result. Audio is
// addressed to a battle role so a shared PvP snapshot can correctly play a
// victory sound for one player and the loss sound for the other.
export function getBattleResultAudioEvents(state) {
  if (state?.status !== "finished" || !["host", "guest"].includes(state?.winner)) return [];
  const winner = state.winner;
  const loser = winner === "host" ? "guest" : "host";
  const winnerHasOnePokemonRemaining = getLivingPokemon(state?.[winner]?.team).length === 1;
  return [
    {
      id: `battle-result:${winner}`,
      audience: winner,
      sound: winnerHasOnePokemonRemaining ? BATTLE_EVENT_SOUND.BRUTALITY : BATTLE_EVENT_SOUND.VICTORY,
    },
    { id: `battle-result:${loser}`, audience: loser, sound: BATTLE_EVENT_SOUND.DEFEAT },
  ];
}

function getFinishHimEvents(state) {
  if (state?.status === "finished") return [];
  return ["host", "guest"].flatMap((side) => {
    const living = getLivingPokemon(state?.[side]?.team);
    const lastPokemon = living[0];
    const hpPercentage = lastPokemon?.maxHp > 0 ? (lastPokemon.hp / lastPokemon.maxHp) * 100 : 0;
    if (living.length !== 1 || hpPercentage >= 20) return [];
    return [{ id: `finish-him:${side}`, sound: BATTLE_EVENT_SOUND.FINISH_HIM }];
  });
}

// These events travel inside the already-authoritative battle state. The host
// creates them once and both clients consume the same event ID, rather than
// inferring audio separately from their React render cycle.
export function appendBattleAudioEvents(previous, next, { mode } = {}) {
  if (!next || previous === next) return next;
  const existing = Array.isArray(next.audioEvents) ? next.audioEvents : [];
  const knownIds = new Set(existing.map((event) => event?.id));
  const additions = [];
  if (next.status === "playing" && previous?.status !== "playing") {
    additions.push({ id: "battle-start", sound: BATTLE_EVENT_SOUND.START_BATTLE });
    const sound = getBadgeRoundSound(mode, next.seriesBattleNumber);
    if (sound) additions.push({ id: `badge-round:${next.seriesBattleNumber}`, sound });
    const journeySound = next.journeyRouteId ? getRoundStartSound(next.journeyBattleNumber) : null;
    if (journeySound) additions.push({ id: `journey-round:${next.journeyBattleNumber}`, sound: journeySound });
  }
  if (next.status === "finished" && previous?.status !== "finished") {
    additions.push(...getBattleResultAudioEvents(next));
  } else {
    additions.push(...getFinishHimEvents(next));
  }
  const fresh = additions.filter((event) => event?.id && event?.sound && !knownIds.has(event.id));
  return fresh.length ? { ...next, audioEvents: [...existing, ...fresh].slice(-20) } : next;
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
