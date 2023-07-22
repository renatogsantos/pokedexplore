import axios from "axios";

export async function getPokemonPage(pokemon) {
  return axios
    .get(`https://pokeapi.co/api/v2/pokemon/${pokemon}`)
    .then((resp) => resp.data)
    .catch((error) => {
      console.error(error);
      throw error;
    });
}
