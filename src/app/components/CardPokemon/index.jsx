import { convertHeightToMeters, convertWeightToKilograms } from "@/app/helpers";
import { pokemonData } from "@/app/helpers/PokemonTypes";
import { actOpenCardPokemon, getPokemonWeaknesses } from "@/app/redux/pokemons";
import {
  Barbell,
  Gauge,
  HandFist,
  Heartbeat,
  Ruler,
  ShieldChevron,
  ShieldPlus,
  Sword,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Col, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";

export default function CardPokemon({ pokemon }) {
  const dispatch = useDispatch();
  const [color, setColor] = useState("#fff");
  const { Weaknesses } = useSelector((state) => state.pokemons);

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

  useEffect(() => {
    dispatch(getPokemonWeaknesses(pokemon.name));
  }, [pokemon]);

  return (
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

      <div className="d-flex aling-items-center justify-content-between w-100 pt-3">
        <div className="d-flex flex-column align-items-center justify-content-center w-100 text-center mx-2">
          <span className="pokemon-stats mx-4 w-100">
            {convertHeightToMeters(pokemon.height)} M
          </span>
          <p className="d-flex align-items-center m-0">
            <Ruler size={24} weight="duotone" /> Altura
          </p>
        </div>
        <div className="d-flex align-items-center justify-content-center w-100 gap-3 border-end border-start px-3">
          {pokemon.types.map((type, i) => {
            return (
              <img
                key={i}
                draggable={false}
                width={40}
                src={`/types/${type.type.name}.svg`}
                alt=""
              />
            );
          })}
        </div>
        <div className="d-flex flex-column align-items-center justify-content-center w-100 text-center mx-2">
          <span className="pokemon-stats mx-4 w-100">
            {convertWeightToKilograms(pokemon.weight)} Kg
          </span>
          <p className="d-flex align-items-center m-0">
            <Barbell size={24} weight="duotone" /> Peso
          </p>
        </div>
      </div>

      <div className="py-4 w-100">
        {pokemon.stats.map((stats, i) => {
          return (
            <Row key={i}>
              <Col xs="1">
                {stats.stat.name == "hp" ? (
                  <Heartbeat
                    size={24}
                    weight="duotone"
                    title={stats.stat.name}
                  />
                ) : stats.stat.name == "attack" ? (
                  <HandFist
                    size={24}
                    weight="duotone"
                    title={stats.stat.name}
                  />
                ) : stats.stat.name == "defense" ? (
                  <ShieldChevron
                    size={24}
                    weight="duotone"
                    title={stats.stat.name}
                  />
                ) : stats.stat.name == "special-attack" ? (
                  <Sword size={24} weight="duotone" title={stats.stat.name} />
                ) : stats.stat.name == "special-defense" ? (
                  <ShieldPlus
                    size={24}
                    weight="duotone"
                    title={stats.stat.name}
                  />
                ) : stats.stat.name == "speed" ? (
                  <Gauge size={24} weight="duotone" title={stats.stat.name} />
                ) : (
                  ""
                )}
              </Col>
              <Col xs="1">
                <span>{stats.base_stat}</span>
              </Col>
              <Col xs>
                <meter
                  value={stats.base_stat}
                  min={0}
                  max={200}
                  low={60}
                  high={180}
                  optimum={120}
                />
              </Col>
            </Row>
          );
        })}
        <div className="d-flex gap-2 align-items-center">
          <span>Fraquezas:</span>
          <div className="d-flex gap-2">
            {Weaknesses.map((weak, i) => {
              return (
                <img
                  className="scale-in-center"
                  key={i}
                  draggable={false}
                  width={28}
                  src={`/types/${weak}.svg`}
                  alt={weak}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
