import CardPokemon from "@/components/CardPokemon";
import { getPokemonPage } from "@/services/pokemons";

export default async function Pokemon({ params }) {
  const pokemon = await getPokemonPage(params.pokemon);

  //criar um componente de página aqui
  return (
    <div className="d-flex align-items-center justify-content-center vh-100 w-100">
      <CardPokemon pokemon={pokemon} />
    </div>
  );
}
