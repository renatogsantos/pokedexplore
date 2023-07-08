"use client";

import axios from "axios";
import { useEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
  getPokemon,
  getPokemons,
  getTypesPokemons,
  nextPage,
  previousPage,
} from "./redux/pokemons";
import CardPoke from "./components/CardPoke";
import ButtonPrimary from "./components/ButtonPrimary";
import {
  ArrowCircleLeft,
  ArrowCircleRight,
  Clipboard,
  Lightning,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import Waves from "./components/Waves";
import { pokemonData } from "./helpers/PokemonTypes";
import ButtonSecondary from "./components/ButtonSecondary";

export default function Home() {
  const [initialPokemon, setInitialPokemon] = useState(
    Math.floor(Math.random() * 1000) + 1
  );
  const [search, setSearch] = useState("");
  const dispatch = useDispatch();
  const { Pokemons, Pokemon, NextPage, PreviousPage } = useSelector(
    (state) => state.pokemons
  );

  const divRef = useRef(null);

  function redirecionarParaDiv() {
    let div = document.getElementById("Pokemons");
    if (div) {
      setTimeout(() => {
        div.scrollIntoView();
      }, 500);
    }
  }

  useEffect(() => {
    dispatch(getPokemons(6));
  }, []);

  useEffect(() => {
    dispatch(getPokemon(initialPokemon));
  }, [initialPokemon]);

  useEffect(() => {
    const handleScroll = (event) => {
      const { deltaX } = event;
      const div = divRef.current;
      div.scrollLeft += deltaX;
    };

    const div = divRef.current;
    div.addEventListener("wheel", handleScroll, { passive: false });

    return () => {
      div.removeEventListener("wheel", handleScroll);
    };
  }, []);

  return (
    <main>
      <Container fluid className="bg-hero pb-5 mb-5">
        <Container className="py-5">
          <div className="d-flex align-items-center justify-content-center">
            <img width="300" src="/pokedexplore.svg" alt="PokédExplore" />
          </div>
          <Row className="align-items-center">
            <Col sm="12" xl="6" className="py-5 order-last order-lg-first">
              <h1>Bulbasaur</h1>
              <div className="d-flex gap-2 mb-3">
                <img
                  draggable={false}
                  width={40}
                  src="/types/grass.svg"
                  alt="Grass"
                />
                <img
                  draggable={false}
                  width={40}
                  src="/types/poison.svg"
                  alt="Poison"
                />
              </div>
              <p className="mb-3">
                Bulbasaur é um Pokémon do tipo Grama/Veneno. Ele é conhecido por
                ter uma semente de planta crescendo em suas costas desde o
                nascimento. Sua planta absorve nutrientes e cresce à medida que
                evolui. Bulbasaur usa suas habilidades de planta para atacar,
                como o Vine Whip. É um Pokémon dócil e amigável, mas também pode
                ser um lutador feroz quando necessário. Sua evolução é muito
                esperada por treinadores, pois se torna um poderoso Venusaur.
                Bulbasaur é um parceiro leal e um ótimo começo para qualquer
                treinador Pokémon.
              </p>
              <ButtonPrimary
                type="button"
                title="Mais detalhes"
                variant="w-100"
                icon={<Lightning size={24} weight="duotone" />}
                onClick={() => {}}
              />
            </Col>
            <Col sm="12" xl="6">
              <img
                draggable={false}
                width="100%"
                src="/pokemons/bulbasaur-image.png"
                alt="Pokemon Bulbasaur"
              />
            </Col>
          </Row>
        </Container>
        <img
          draggable={false}
          className="bottom-wave"
          src="/svgs/bottom-wave.svg"
          alt="Bottom wave"
        />
      </Container>

      <Container fluid className="m-0 p-0 bg-black">
        <Container className="py-5">
          <Row>
            <Col sm="12" lg="6">
              <span className="d-flex align-items-center gap-2 py-2">
                <Clipboard size={24} weight="duotone" /> Busque por tipo:
              </span>
              <div
                ref={divRef}
                className="main-card-scroll-x p-2"
                title="Pressione ALT para scrollar"
              >
                {pokemonData.map((type) => {
                  return (
                    <button
                      key={type.type}
                      type="button"
                      className=""
                      onClick={() => {
                        dispatch(getTypesPokemons(type.type));
                      }}
                    >
                      <img
                        width={30}
                        src={`/types/${type.type}.svg`}
                        alt="teste"
                      />
                    </button>
                  );
                })}
              </div>
            </Col>
            <Col>
              <span className="d-flex align-items-center gap-2 py-2">
                <MagnifyingGlass size={24} weight="duotone" />
                Encontre seu pokémon:
              </span>
              <div className="d-flex">
                <input
                  className="main-input"
                  placeholder="Eu escolho você!"
                  onChange={(e) => {
                    setSearch(e.target.value);
                  }}
                />
                <ButtonSecondary
                  type="button"
                  icon={<MagnifyingGlass size={24} weight="duotone" />}
                  onClick={() => {
                    dispatch(getPokemon(search.toLowerCase()));
                  }}
                />
              </div>
            </Col>
          </Row>
          <Row id="Pokemons" className="g-4 py-5">
            {Pokemons.map((pokemon) => {
              return (
                <Col
                  key={pokemon.name}
                  sm="12"
                  md="6"
                  lg="4"
                  className="mt-5 pt-5"
                >
                  <div>
                    <CardPoke
                      name={pokemon.name}
                      img={pokemon.sprites.other.home.front_default}
                      types={pokemon.types}
                      height={pokemon.height}
                      weight={pokemon.weight}
                    />
                  </div>
                </Col>
              );
            })}
          </Row>
          <div className="d-flex align-items-center justify-content-between w-100">
            <ButtonPrimary
              type="button"
              title="Anterior"
              icon={<ArrowCircleLeft size={24} weight="duotone" />}
              onClick={() => {
                dispatch(previousPage(PreviousPage));
                redirecionarParaDiv();
              }}
            />
            <ButtonPrimary
              type="button"
              title="Próxima"
              icon={<ArrowCircleRight size={24} weight="duotone" />}
              onClick={() => {
                dispatch(nextPage(NextPage));
                redirecionarParaDiv();
              }}
            />
          </div>
        </Container>
      </Container>
    </main>
  );
}
