import { getPokemonPage } from "@/services/pokemons";
import PokemonPage from "./PokemonPage";

export default async function Pokemon({ params }) {
  const pokemon = await getPokemonPage(params.pokemon);
  //console.log(params) params representa o dado adicionado na url exe: localhost/pikachu
  //{params: "pikachu"}

  //criar um componente de página aqui
  return <PokemonPage pokemon={pokemon} />;
}
