"use client";
import ButtonPrimary from "@/components/ButtonPrimary";
import StatusBar from "@/components/StatusBar";
import Waves from "@/components/Waves";
import { pokemonData } from "@/helpers/PokemonTypes";
import { getPokemonWeaknesses } from "@/redux/pokemons";
import {
  ArrowCircleLeft,
  Gauge,
  HandFist,
  Heartbeat,
  ShieldChevron,
  ShieldPlus,
  Sword,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";

export default function PokemonPage({ pokemon }) {
  const dispatch = useDispatch();
  const [color, setColor] = useState("#000");
  const { Weaknesses, OpenCardPokemon } = useSelector(
    (state) => state.pokemons
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
  const Color = getColorByType(pokemon.types[0].type.name);

  useEffect(() => {
    setColor(Color);
  }, []);

  useEffect(() => {
    dispatch(getPokemonWeaknesses(pokemon.name));
  }, [pokemon]);
  console.log(pokemon);

  return (
    <div
      className="pokemon-page-home"
      style={{
        backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(150% 50% at 50% bottom, ${color}, #060e20cc)`,
      }}
    >
      <Container
        fluid
        className="py-3 py-lg-5 position-relative overflow-hidden text-light"
      >
        <Waves />
        <Container className="py-3 py-lg-5">
          <Row className="align-items-center g-3 pb-4">
            <Col xs="12" lg="2">
              <img
                draggable={false}
                width="100%"
                src="/pokedexplore.svg"
                alt="PokédExplore"
              />
            </Col>
            <Col
              xs="12"
              lg
              className="d-flex justify-content-center justify-content-lg-end"
            >
              <ButtonPrimary
                link="/#pokedex"
                title="Voltar"
                icon={<ArrowCircleLeft size={24} weight="duotone" />}
              />
            </Col>
          </Row>
          <hr />
          <div className="text-center">
            <h1>{pokemon.name}</h1>
          </div>
          <Row className="align-items-center">
            <p className="mb-4">
              Conheça o incrível Pokémon{" "}
              <span className="capitalize">{pokemon.name}</span>, um ser
              misterioso e poderoso com habilidades surpreendentes. Sua natureza
              se reflete em seus tipos:{" "}
              {pokemon.types.map((type, i) => {
                return (
                  <span key={i} className="capitalize pe-1">
                    {type.type.name}
                  </span>
                );
              })}
              . Seja em batalhas ou aventuras,
              <span className="capitalize"> {pokemon.name}</span> é um
              companheiro valioso e pronto para enfrentar qualquer desafio!
            </p>
            <Col sm="12" xl="7">
              <div className="text-light p-lg-5">
                <div className="d-flex align-items-center w-100 gap-3">
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
                <div className="pt-4 w-100">
                  {pokemon.stats.map((stats, i) => {
                    return (
                      <Row key={i} className="align-items-center">
                        <Col xs="2" sm="1" className="py-3">
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
                            <Sword
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "special-defense" ? (
                            <ShieldPlus
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : stats.stat.name == "speed" ? (
                            <Gauge
                              size={24}
                              weight="duotone"
                              title={stats.stat.name}
                            />
                          ) : (
                            ""
                          )}
                        </Col>
                        <Col xs="2" sm="1">
                          <span>{stats.base_stat}</span>
                        </Col>
                        <Col xs="8" sm="3">
                          <span>{stats.stat.name}</span>
                        </Col>
                        <Col xs="12" sm>
                          <StatusBar status={stats.base_stat} />
                        </Col>
                      </Row>
                    );
                  })}
                  <div className="d-flex flex-column flex-lg-row gap-2 align-items-center py-3">
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
            </Col>
            <Col
              sm="12"
              xl="5"
              className="order-first order-xl-last text-center py-3"
            >
              <img
                draggable={false}
                width="100%"
                src={
                  pokemon.sprites.other["official-artwork"].front_default
                    ? pokemon.sprites.other["official-artwork"].front_default
                    : pokemon.sprites.other.home.front_default
                    ? pokemon.sprites.other.home.front_default
                    : "pokenull.png"
                }
                alt={pokemon.name}
              />
            </Col>
          </Row>
        </Container>
      </Container>
    </div>
  );
}
