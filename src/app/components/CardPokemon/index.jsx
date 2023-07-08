import { pokemonData } from "@/app/helpers/PokemonTypes";
import { actOpenCardPokemon } from "@/app/redux/pokemons";
import { XCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

export default function CardPokemon({ pokemon }) {
  const { OpenCardPokemon } = useSelector((state) => state.pokemons);
  const dispatch = useDispatch();
  const [color, setColor] = useState("#fff");

  function getColorByType(pokemonType) {
    const foundPokemon = pokemonData.find(
      (pokemon) => pokemon.type === pokemonType
    );
    if (foundPokemon) {
      return foundPokemon.color;
    } else {
      return null;
    }
  }

  useEffect(() => {
    if (pokemon) {
      const Color = getColorByType(pokemon ? pokemon.types[0].type.name : "");
      setColor(Color);
    }
  }, [pokemon]);

  return (
    <>
      {OpenCardPokemon && (
        <div className="card-pokemon-box">
          <div
            className="card-pokemon slide-in-top p-3 p-lg-5"
            style={{
              backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${
                color + "80"
              }, #060e20cc)`,
            }}
          >
            <button
              type="button"
              className="button-close"
              onClick={() => {
                dispatch(actOpenCardPokemon(false));
              }}
            >
              <XCircle size={32} weight="duotone" />
            </button>
            <img
              width="280"
              src={pokemon ? pokemon.sprites?.other.home.front_default : ""}
            />
            <span className="card-pokemon-name">{pokemon.name}</span>
          </div>
        </div>
      )}
    </>
  );
}
