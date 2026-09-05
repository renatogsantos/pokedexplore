import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";

const source = await fs.readFile(new URL("./pokemonSequence.js", import.meta.url), "utf8");
const { SECRET_SEQUENCE_TIMEOUT_MS, advancePokemonSecret } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("the exact Pokémon ID sequence unlocks only on its sixth input", () => {
  let progress = { index: 0, lastInputAt: 0 };
  [1, 5, 9, 7, 5].forEach((id, index) => { const next = advancePokemonSecret(progress, id, index + 1); progress = next.progress; assert.equal(next.unlocked, false); });
  assert.equal(advancePokemonSecret(progress, 3, 6).unlocked, true);
});
test("a wrong input resets silently but a new Bulbasaur restarts the sequence", () => {
  let progress = advancePokemonSecret({ index: 0, lastInputAt: 0 }, 1, 1).progress;
  progress = advancePokemonSecret(progress, 5, 2).progress;
  assert.equal(advancePokemonSecret(progress, 25, 3).progress.index, 0);
  assert.equal(advancePokemonSecret(progress, 1, 4).progress.index, 1);
});
test("an input after the timeout cannot continue an older attempt", () => {
  const first = advancePokemonSecret({ index: 0, lastInputAt: 0 }, 1, 10).progress;
  assert.equal(advancePokemonSecret(first, 5, 10 + SECRET_SEQUENCE_TIMEOUT_MS + 1).progress.index, 0);
});
