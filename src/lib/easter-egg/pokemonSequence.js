export const SECRET_POKEMON_SEQUENCE = [1, 5, 9, 7, 5, 3];
export const SECRET_REWARD_COINS = 1_000_000;
export const SECRET_SEQUENCE_TIMEOUT_MS = 15_000;
export const SECRET_REWARD_ID = "millionCoinsPokemonSequence";

export function advancePokemonSecret(previous = { index: 0, lastInputAt: 0 }, pokemonId, now = Date.now()) {
  const expired = previous.lastInputAt && now - previous.lastInputAt > SECRET_SEQUENCE_TIMEOUT_MS;
  const index = expired ? 0 : previous.index;
  const expected = SECRET_POKEMON_SEQUENCE[index];
  const nextIndex = pokemonId === expected ? index + 1 : pokemonId === SECRET_POKEMON_SEQUENCE[0] ? 1 : 0;
  const unlocked = nextIndex === SECRET_POKEMON_SEQUENCE.length;
  return { unlocked, progress: unlocked ? { index: 0, lastInputAt: 0 } : { index: nextIndex, lastInputAt: now } };
}
