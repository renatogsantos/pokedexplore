import { pokemonData } from "@/helpers/PokemonTypes";
import { getPokemon } from "@/redux/pokemons";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";

export default function CardPokedex({ pokemon }) {
  const [color, setColor] = useState("#fff");
  const dispatch = useDispatch();

  function getColorByType(pokemonType) {
    const foundPokemon = pokemonData.find((pokemon) => pokemon.type === pokemonType);
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
    <motion.button
      initial={{ opacity: 0, scale: 0.9, z: -10 }}
      whileInView={{ opacity: 1, scale: 1, z: 0 }}
      exit={{ opacity: 0, scale: 0.9, z: 10 }}
      transition={{ duration: 0.8, bounce: 0.5, type: "spring" }}
      href={`/${pokemon.id}`}
      onClick={() => {
        dispatch(getPokemon(pokemon.name));
      }}
    >
      <div
        key={pokemon.name}
        className="card-pokedex"
        style={{
          backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${color}, #060e20cc)`,
        }}
      >
        <img
          loading="lazy"
          draggable={false}
          src={
            pokemon.sprites.other["official-artwork"].front_default
              ? pokemon.sprites.other["official-artwork"].front_default
              : "/pokenull.png"
          }
          alt="Pokemon"
        />
      </div>
    </motion.button>
  );
}
