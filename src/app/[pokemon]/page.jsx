import { getPokemonPage } from "@/services/pokemons";
import PokemonPage from "./PokemonPage";

export default async function Pokemon({ params }) {
  const pokemon = await getPokemonPage(params.pokemon);

  //criar um componente de página aqui
  return <PokemonPage pokemon={pokemon} />;
}
