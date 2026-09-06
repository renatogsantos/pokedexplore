import axios from "axios";
import { webStore } from "@/helpers/webStore";

export async function getPokemonPage(pokemon) {
  const cacheKey = "pokemon:" + String(pokemon).toLowerCase();
  if (typeof window !== "undefined") {
    const cached = await webStore.getCachedResource(cacheKey);
    if (cached) return cached;
  }
  const data = await axios
    .get("https://pokeapi.co/api/v2/pokemon/" + pokemon)
    .then((resp) => resp.data)
    .catch((error) => {
      console.error(error);
      throw error;
    });
  if (typeof window !== "undefined") void webStore.setCachedResource(cacheKey, data);
  return data;
}
