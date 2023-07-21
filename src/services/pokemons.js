import axios from "axios";

export async function getPokemonPage(pokemon) {
  const data = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`);
  const response = await data.data;
  return response;
}
