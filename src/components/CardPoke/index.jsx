import { convertHeightToMeters, convertWeightToKilograms } from "@/helpers";
import { pokemonData } from "@/helpers/PokemonTypes";
import { Barbell, Lightning, Ruler } from "@phosphor-icons/react";
import ButtonPrimary from "../ButtonPrimary";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getPokemon } from "@/redux/pokemons";

export default function CardPoke({ id, img, name, types, weight, height }) {
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

  const Color = getColorByType(types[0].type.name);
  useEffect(() => {
    setColor(Color);
  }, []);

  return (
    <div
      className="card-poke slide-in-top"
      style={{
        backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${color}, #060e20cc)`,
      }}
    >
      <div className="card-poke-img">
        {img ? (
          <img draggable={false} width="280" src={img} />
        ) : (
          <img draggable={false} width="280" src="/pokenull.png" />
        )}
      </div>

      <div className="mt-5 d-flex flex-column align-items-center justify-content-center w-100">
        <span className="pokemon-name py-2">{name}</span>
        <div className="d-flex gap-1 py-1">
          {types.map((item, i) => {
            return (
              <span key={i} className={item.type.name}>
                <img
                  width={18}
                  src={`/icons/${item.type.name}.svg`}
                  alt={item.type.name}
                />
                {item.type.name}
              </span>
            );
          })}
        </div>

        <div className="d-flex aling-items-center justify-content-between w-100 pt-3">
          <div className="d-flex flex-column align-items-center justify-content-center w-100">
            <span className="pokemon-stats">
              {convertHeightToMeters(height)} M
            </span>
            <p className="d-flex align-items-center m-0">
              <Ruler size={24} weight="duotone" /> Altura
            </p>
          </div>
          <div className="d-flex flex-column align-items-center justify-content-center w-100">
            <span className="pokemon-stats">
              {convertWeightToKilograms(weight)} Kg
            </span>
            <p className="d-flex align-items-center m-0">
              <Barbell size={24} weight="duotone" /> Peso
            </p>
          </div>
        </div>

        <div className="d-flex align-items-center justify-content-center mt-4 w-100">
          <ButtonPrimary
            type="button"
            title="Mais detalhes"
            icon={<Lightning size={24} weight="duotone" />}
            onClick={() => {
              dispatch(getPokemon(name));
            }}
          />
        </div>
      </div>
    </div>
  );
}
