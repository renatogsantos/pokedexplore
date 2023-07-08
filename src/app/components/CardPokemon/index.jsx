import { convertHeightToMeters, convertWeightToKilograms, extrairPrimeiraPalavra } from "@/app/helpers";
import { pokemonData } from "@/app/helpers/PokemonTypes";
import { actOpenCardPokemon } from "@/app/redux/pokemons";
import { Barbell, Ruler, XCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Col, Row } from "react-bootstrap";
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
                {pokemon.types.map((type) => {
                  return (
                    <img
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
              {pokemon.stats.map((stats) => {
                return (
                  <Row key={stats.base_stat}>
                    <Col sm="3">
                      <span>{extrairPrimeiraPalavra(stats.stat.name, "-")}</span>
                    </Col>
                    <Col sm="1">
                      <span>{stats.base_stat}</span>
                    </Col>
                    <Col sm>
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
