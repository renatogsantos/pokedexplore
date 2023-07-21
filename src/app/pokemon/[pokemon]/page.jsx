import CardPokemon from "@/components/CardPokemon";
import { getPokemonPage } from "@/services/pokemons";
import { Container } from "react-bootstrap";

export default async function Pokemon({ params }) {
  const pokemon = await getPokemonPage(params.pokemon);

  return (
    <div className="d-flex align-items-center justify-content-center vh-100 w-100">
      <CardPokemon pokemon={pokemon} />
    </div>
  );
}
