import { getPokemonLevel } from "./progression";

export const SPRITE_CONTEXT = Object.freeze({ GENERAL: "general", BATTLE_THUMBNAIL: "battle-thumbnail", BATTLE_ACTIVE: "battle-active" });

const value = (pokemon, ...paths) => paths.map((path) => path.split(".").reduce((node, key) => node?.[key], pokemon)).find(Boolean) || null;

export function isPokemonShiny(levelOrPokemon) {
  const level = typeof levelOrPokemon === "object" ? getPokemonLevel(levelOrPokemon) : Number(levelOrPokemon) || 1;
  return level > 5;
}

export function normalizePokemonVisuals(pokemon) {
  const officialDefault = value(pokemon, "visuals.official.default", 'sprites.other.official-artwork.front_default');
  const officialShiny = value(pokemon, "visuals.official.shiny", 'sprites.other.official-artwork.front_shiny');
  const homeDefault = value(pokemon, "visuals.home.default", "sprites.other.home.front_default");
  const homeShiny = value(pokemon, "visuals.home.shiny", "sprites.other.home.front_shiny");
  return { official: { default: officialDefault, shiny: officialShiny }, home: { default: homeDefault, shiny: homeShiny }, showdown: { front: { default: value(pokemon, "visuals.showdown.front.default", "sprites.other.showdown.front_default"), shiny: value(pokemon, "visuals.showdown.front.shiny", "sprites.other.showdown.front_shiny") }, back: { default: value(pokemon, "visuals.showdown.back.default", "sprites.other.showdown.back_default"), shiny: value(pokemon, "visuals.showdown.back.shiny", "sprites.other.showdown.back_shiny") } } };
}

export function getPokemonSprite({ pokemon, context = SPRITE_CONTEXT.GENERAL }) {
  const visuals = normalizePokemonVisuals(pokemon);
  const shiny = isPokemonShiny(pokemon);
  const fallback = value(pokemon, "artwork", "image", "imageUrl", "sprite", "sprites.front_default") || "/pokenull.png";
  const prefer = (items) => items.find(Boolean) || fallback;
  const isPokeApiPokemon = Number.isFinite(Number(pokemon?.id)) && pokemon?.source !== "custom" && !pokemon?.customId;
  const showdownFallback = isPokeApiPokemon ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokemon.id}${shiny ? "-shiny" : ""}.gif` : null;
  if (context === SPRITE_CONTEXT.BATTLE_THUMBNAIL) return shiny ? prefer([visuals.showdown.front.shiny, visuals.showdown.front.default, showdownFallback, visuals.official.shiny, visuals.official.default, visuals.home.shiny, visuals.home.default]) : prefer([visuals.showdown.front.default, showdownFallback, visuals.official.default, visuals.home.default]);
  // Both large arena sides are presentation elements: always official artwork.
  return shiny ? prefer([visuals.official.shiny, visuals.official.default, visuals.home.shiny, visuals.home.default]) : prefer([visuals.official.default, visuals.home.default]);
}
