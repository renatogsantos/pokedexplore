import { convertHeightToMeters, convertWeightToKilograms } from "@/app/helpers";
import { pokemonData } from "@/app/helpers/PokemonTypes";
import { Barbell, Lightning, Ruler } from "@phosphor-icons/react";
import ButtonPrimary from "../ButtonPrimary";

export default function CardPoke({ img, name, types, weight, height }) {
  const colorTypes = pokemonData.filter((el) =>
    el.type.includes(types[0].type.name)
  );

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

  const color = getColorByType(types[0].type.name);

  return (
    <div
      className="card-poke slide-in-top"
      style={{
        backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${
          color + "80"
        }, #060e20cc)`,
      }}
    >
      <div className="card-poke-img">
        {img ? (
          <img draggable={false} width="280" src={img} />
        ) : (
          <img draggable={false} width="280" src="/pokeball-load.gif" />
        )}
      </div>
      <div className="mt-5 d-flex flex-column align-items-center justify-content-center w-100">
        <span className="pokemon-name">{name}</span>
        <div className="d-flex gap-5 py-1">
          {types.map((item, i) => {
            return (
              <span key={i} className={item.type.name}>
                <img
                  width={18}
                  src={`/icons/${item.type.name}.svg`}
                  alt=""
                  srcset=""
                />
                {item.type.name}
              </span>
            );
          })}
        </div>

        <div className="d-flex aling-items-center justify-content-between w-100 pt-3">
          <div className="d-flex flex-column align-items-center justify-content-center w-100">
            <span className="pokemon-stats">
              {convertHeightToMeters(height)}
            </span>
            <p className="d-flex align-items-center m-0">
              <Ruler size={24} weight="duotone" /> Altura
            </p>
          </div>
          <div className="d-flex flex-column align-items-center justify-content-center w-100">
            <span className="pokemon-stats mx-4">
              {convertWeightToKilograms(weight)}
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
          />
        </div>
      </div>
    </div>
  );
}
