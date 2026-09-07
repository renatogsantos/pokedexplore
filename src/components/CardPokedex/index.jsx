import { pokemonData } from "@/helpers/PokemonTypes";
import { getPokemon } from "@/redux/pokemons";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";

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
      type="button"
      aria-label={`Ver detalhes de ${pokemon.name}`}
      title={`Ver detalhes de ${pokemon.name}`}
      initial={{ opacity: 0, scale: 0.9, z: -10 }}
      whileInView={{ opacity: 1, scale: 1, z: 0 }}
      exit={{ opacity: 0, scale: 0.9, z: 10 }}
      transition={{ duration: 0.8, bounce: 0.5, type: "spring" }}
      onClick={() => {
        dispatch(getPokemon(pokemon.name));
      }}
    >
      <div
        key={pokemon.name}
        className={`card-pokedex ${getRarityClassName(pokemon)}`}
        style={{
          backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${color}, #060e20cc)`,
        }}
        >
          <span className="pokedex-level">Lv. {getPokemonLevel(pokemon)}</span>
          <PokemonRarity pokemon={pokemon} compact />
          <img
          loading="lazy"
          draggable={false}
          src={
            getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.GENERAL })
          }
          alt="Pokemon"
        />
      </div>
    </motion.button>
  );
}
