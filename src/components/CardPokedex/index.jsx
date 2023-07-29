import { pokemonData } from "@/helpers/PokemonTypes";
import { getPokemon } from "@/redux/pokemons";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

export default function CardPokedex({ pokemon }) {
  const [color, setColor] = useState("#fff");
  const dispatch = useDispatch();

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
    <button
      href={`/${pokemon.id}`}
      onClick={() => {
        dispatch(getPokemon(pokemon.name));
      }}
    >
      <div
        key={pokemon.name}
        className="card-pokedex"
        style={{
          backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${
            color + "80"
          }, #060e20cc)`,
        }}
      >
        <img
          draggable={false}
          loading="lazy"
          src={
            pokemon.sprites.other["official-artwork"].front_default
              ? pokemon.sprites.other["official-artwork"].front_default
              : "/pokenull.png"
          }
          alt="Pokemon"
        />
      </div>
    </button>
  );
}
