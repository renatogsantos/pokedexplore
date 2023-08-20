"use client";
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
import StatusBar from "../StatusBar";
import { actOpenCardPokemon, getPokemonWeaknesses } from "@/redux/pokemons";
import { convertHeightToMeters, convertWeightToKilograms } from "@/helpers";
import { pokemonData } from "@/helpers/PokemonTypes";

export default function CardPokemon({ pokemon }) {
  const dispatch = useDispatch();
  const [color, setColor] = useState("#fff");
  const { Weaknesses, OpenCardPokemon } = useSelector(
    (state) => state.pokemons
  );

  const [startY, setStartY] = useState(0);
  const [endY, setEndY] = useState(0);
  const [slideOut, setSlideOut] = useState(false);

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

  const handleClosePropagation = (e) => {
    e.stopPropagation();
  };

  useEffect(() => {
    const handleTouchStart = (event) => {
      setStartY(event.touches[0].clientY);
    };

    const handleTouchMove = (event) => {
      setEndY(event.touches[0].clientY);
    };

    const handleTouchEnd = () => {
      if (startY > endY) {
        setSlideOut(true);
        setTimeout(() => {
          dispatch(actOpenCardPokemon(false));
        }, 500);
      }
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [startY, endY]);

  useEffect(() => {
    if (pokemon) {
      const Color = getColorByType(pokemon ? pokemon.types[0].type.name : "");
      setColor(Color);
    }
  }, [pokemon]);

  useEffect(() => {
    dispatch(getPokemonWeaknesses(pokemon.name));
    setSlideOut(false);
  }, [pokemon]);

  useEffect(() => {
    if (OpenCardPokemon) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [OpenCardPokemon]);

  return (
    <div
      onClick={handleClosePropagation}
      className={`card-pokemon slide-in-top p-3 px-lg-5 pb-lg-5 ${
        slideOut ? "slide-out-top" : ""
      }`}
      style={{
        backgroundImage: `url('/svgs/half-pokeball.svg'), radial-gradient(80% 80% at 50% bottom, ${
          color
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
        draggable={false}
        className="card-pokemon-img"
        src={
          pokemon.sprites.other["official-artwork"].front_default
            ? pokemon.sprites.other["official-artwork"].front_default
            : pokemon.sprites.other.home.front_default
            ? pokemon.sprites.other.home.front_default
            : "pokenull.png"
        }
        alt="Pokémon selecionado"
      />
      <span className="card-pokemon-name py-2">{pokemon.name}</span>

      <div className="d-flex aling-items-center justify-content-between w-100 py-2 border-top border-bottom">
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

      <div className="pt-4 w-100">
        {pokemon.stats.map((stats, i) => {
          return (
            <Row key={i} className="align-items-center">
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
                <StatusBar status={stats.base_stat} />
              </Col>
            </Row>
          );
        })}
        <div className="d-flex gap-2 align-items-center pt-2">
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
