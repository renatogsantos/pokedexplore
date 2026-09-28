import { getPokemonLevel } from "./progression";

export const SPRITE_CONTEXT = Object.freeze({ GENERAL: "general", BATTLE_THUMBNAIL: "battle-thumbnail", BATTLE_ACTIVE: "battle-active" });

const SAFE_LOCAL_FALLBACK = "/pokenull.png";
const value = (pokemon, ...paths) => paths.map((path) => path.split(".").reduce((node, key) => node?.[key], pokemon)).find(Boolean) || null;
const validSource = (source) => {
  if (typeof source !== "string") return null;
  const normalized = source.trim();
  if (!normalized || ["undefined", "null", "[object Object]"].includes(normalized.toLowerCase())) return null;
  if (normalized.startsWith("/")) return normalized;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};
const candidates = (entries) => {
  const seen = new Set();
  return entries.reduce((result, entry) => {
    const src = validSource(entry?.src);
    if (!src || seen.has(src)) return result;
    seen.add(src);
    result.push({ ...entry, src });
    return result;
  }, []);
};

export function isPokemonShiny(levelOrPokemon) {
  const level = typeof levelOrPokemon === "object" ? getPokemonLevel(levelOrPokemon) : Number(levelOrPokemon) || 1;
  return level > 5;
}

export function normalizePokemonVisuals(pokemon) {
  const officialDefault = value(pokemon, "visuals.official.default", "officialArtwork", "officialArtwork.default", "sprites.other.official-artwork.front_default");
  const officialShiny = value(pokemon, "visuals.official.shiny", "officialArtwork.shiny", "sprites.other.official-artwork.front_shiny");
  const homeDefault = value(pokemon, "visuals.home.default", "sprites.other.home.front_default");
  const homeShiny = value(pokemon, "visuals.home.shiny", "sprites.other.home.front_shiny");
  return {
    official: { default: officialDefault, shiny: officialShiny },
    home: { default: homeDefault, shiny: homeShiny },
    showdown: {
      front: { default: value(pokemon, "visuals.showdown.front.default", "sprites.other.showdown.front_default", "animatedSprite"), shiny: value(pokemon, "visuals.showdown.front.shiny", "sprites.other.showdown.front_shiny", "animatedShiny") },
      back: { default: value(pokemon, "visuals.showdown.back.default", "sprites.other.showdown.back_default"), shiny: value(pokemon, "visuals.showdown.back.shiny", "sprites.other.showdown.back_shiny") },
    },
  };
}

function generatedPokeApiSprites(pokemon, shiny) {
  const id = Number(pokemon?.id);
  if (!Number.isFinite(id) || id <= 0 || pokemon?.source === "custom" || pokemon?.customId) return {};
  const suffix = shiny ? "-shiny" : "";
  return {
    gif: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}${suffix}.gif`,
    static: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}${suffix}.png`,
  };
}

export function getPokemonSpriteCandidates({ pokemon, context = SPRITE_CONTEXT.GENERAL, side = null } = {}) {
  const visuals = normalizePokemonVisuals(pokemon);
  const shiny = isPokemonShiny(pokemon);
  const generated = generatedPokeApiSprites(pokemon, shiny);
  const directStatic = shiny
    ? value(pokemon, "sprites.front_shiny", "frontShinySprite", "image_url", "imageUrl", "image", "sprite")
    : value(pokemon, "sprites.front_default", "frontDefaultSprite", "image_url", "imageUrl", "image", "sprite");
  const official = shiny
    ? [visuals.official.shiny, visuals.official.default, pokemon?.artwork]
    : [visuals.official.default, pokemon?.artwork];
  const home = shiny
    ? [visuals.home.shiny, visuals.home.default, pokemon?.homeShinySprite, pokemon?.homeDefaultSprite]
    : [visuals.home.default, pokemon?.homeDefaultSprite];
  const thumbnail = shiny
    ? [
        { src: visuals.showdown.front.shiny, source: "showdown-gif" },
        { src: generated.gif, source: "showdown-gif" },
        { src: visuals.showdown.front.default, source: "showdown-gif" },
        { src: generated.static, source: "battle-static" },
        { src: directStatic, source: "battle-static" },
        ...official.map((src) => ({ src, source: "official-artwork" })),
        ...home.map((src) => ({ src, source: "home-sprite" })),
      ]
    : [
        { src: visuals.showdown.front.default, source: "showdown-gif" },
        { src: generated.gif, source: "showdown-gif" },
        { src: generated.static, source: "battle-static" },
        { src: directStatic, source: "battle-static" },
        ...official.map((src) => ({ src, source: "official-artwork" })),
        ...home.map((src) => ({ src, source: "home-sprite" })),
      ];
  const active = [
    ...official.map((src) => ({ src, source: "official-artwork" })),
    ...home.map((src) => ({ src, source: "home-sprite" })),
    { src: directStatic, source: "battle-static" },
  ];
  return candidates([
    ...(context === SPRITE_CONTEXT.BATTLE_THUMBNAIL ? thumbnail : active),
    { src: SAFE_LOCAL_FALLBACK, source: "local-fallback" },
  ]);
}

export function getPokemonSprite({ pokemon, context = SPRITE_CONTEXT.GENERAL, side = null } = {}) {
  return getPokemonSpriteCandidates({ pokemon, context, side })[0]?.src || SAFE_LOCAL_FALLBACK;
}

export function preloadBattlePokemonSprites(pokemon = []) {
  if (typeof window === "undefined") return Promise.resolve([]);
  const urls = [...new Set(pokemon.slice(0, 6).flatMap((entry) => [
    ...getPokemonSpriteCandidates({ pokemon: entry, context: SPRITE_CONTEXT.BATTLE_ACTIVE }).slice(0, 2).map((candidate) => candidate.src),
    ...getPokemonSpriteCandidates({ pokemon: entry, context: SPRITE_CONTEXT.BATTLE_THUMBNAIL }).slice(0, 3).map((candidate) => candidate.src),
  ]))];
  return Promise.allSettled(urls.map((src) => new Promise((resolve) => {
    const image = new window.Image();
    image.onload = () => resolve(src);
    image.onerror = () => resolve(src);
    image.src = src;
  })));
}
