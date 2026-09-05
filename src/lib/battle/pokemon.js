export function getPokemonArtwork(pokemon) {
  return pokemon?.artwork || pokemon?.sprites?.other?.["official-artwork"]?.front_default || pokemon?.sprites?.other?.home?.front_default || pokemon?.sprites?.front_default || "/pokenull.png";
}

export function getPokemonType(pokemon) {
  return pokemon?.type || pokemon?.types?.[0]?.type?.name || "normal";
}

export function getPokemonHp(pokemon) {
  return pokemon?.maxHp || pokemon?.stats?.find((stat) => stat.stat?.name === "hp")?.base_stat || 90;
}

export function toBattlePokemon(pokemon) {
  const maxHp = getPokemonHp(pokemon);
  return {
    id: pokemon.id,
    name: pokemon.name,
    type: getPokemonType(pokemon),
    artwork: getPokemonArtwork(pokemon),
    maxHp,
    hp: maxHp,
  };
}

export const CPU_TEAM = [
  { id: 7, name: "squirtle", type: "water", maxHp: 88, hp: 88, artwork: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/7.png" },
  { id: 1, name: "bulbasaur", type: "grass", maxHp: 92, hp: 92, artwork: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/1.png" },
  { id: 4, name: "charmander", type: "fire", maxHp: 84, hp: 84, artwork: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/4.png" },
];
