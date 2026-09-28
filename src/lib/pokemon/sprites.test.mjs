import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const spritesSource = (await readFile(new URL("./sprites.js", import.meta.url), "utf8"))
  .replace(
    'import { getPokemonLevel } from "./progression";',
    "const getPokemonLevel = (pokemon) => Math.min(10, Math.max(1, Number(pokemon?.level) || 1));",
  );
const { getPokemonSprite, getPokemonSpriteCandidates, SPRITE_CONTEXT } = await import(
  `data:text/javascript;base64,${Buffer.from(spritesSource).toString("base64")}`,
);

test("battle thumbnails keep animated sprites first and continue through static and artwork fallbacks", () => {
  const candidates = getPokemonSpriteCandidates({
    pokemon: { id: 25, name: "pikachu", level: 8, artwork: "https://cdn.example.test/pikachu-art.png" },
    context: SPRITE_CONTEXT.BATTLE_THUMBNAIL,
  });
  assert.deepEqual(candidates.slice(0, 3).map((candidate) => candidate.source), ["showdown-gif", "battle-static", "official-artwork"]);
  assert.match(candidates[0].src, /showdown\/25-shiny\.gif$/);
  assert.match(candidates[1].src, /pokemon\/25-shiny\.png$/);
  assert.equal(candidates.at(-1).src, "/pokenull.png");
});

test("sprite candidates discard legacy invalid values and preserve a safe local final fallback", () => {
  const candidates = getPokemonSpriteCandidates({
    pokemon: { id: "not-a-pokeapi-id", level: 1, image: "undefined", imageUrl: "", image_url: "null", sprite: "http://unsafe.example/sprite.png" },
    context: SPRITE_CONTEXT.BATTLE_THUMBNAIL,
  });
  assert.deepEqual(candidates, [{ src: "/pokenull.png", source: "local-fallback" }]);
  assert.equal(getPokemonSprite({ pokemon: { image: "undefined" } }), "/pokenull.png");
});

test("custom and serialized Pokémon use their persisted artwork without manufacturing a Showdown URL", () => {
  const custom = getPokemonSpriteCandidates({
    pokemon: { id: 10001, customId: "alicia", source: "custom", image_url: "/pokemons/alicia.png" },
    context: SPRITE_CONTEXT.BATTLE_THUMBNAIL,
  });
  assert.equal(custom[0].src, "/pokemons/alicia.png");
  assert.equal(custom.some((candidate) => candidate.source === "showdown-gif"), false);

  const serialized = getPokemonSpriteCandidates({
    pokemon: { id: 25, level: 1, image_url: "https://cdn.example.test/legacy.png" },
    context: SPRITE_CONTEXT.BATTLE_THUMBNAIL,
  });
  assert.equal(serialized.some((candidate) => candidate.src === "https://cdn.example.test/legacy.png"), true);
});
