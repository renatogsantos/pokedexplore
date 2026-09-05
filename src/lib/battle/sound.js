const SOUND_PATH = "/sound-effect";

export function playBattleSound(name, volume = 0.55) {
  if (typeof window === "undefined") return;

  const audio = new Audio(`${SOUND_PATH}/${name}.mp3`);
  audio.volume = volume;
  audio.play().catch(() => {
    // Navegadores podem bloquear áudio até a primeira interação do usuário.
  });
}
