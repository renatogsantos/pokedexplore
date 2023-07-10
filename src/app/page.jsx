"use client";

import { useEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
  addPokemonCard,
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
  CaretUp,
  Clipboard,
  GithubLogo,
  House,
  Lightning,
  LinkedinLogo,
  MagnifyingGlass,
  Stack,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { pokemonData } from "./helpers/PokemonTypes";
import ButtonSecondary from "./components/ButtonSecondary";
import Link from "next/link";
import CardPokemon from "./components/CardPokemon";
import { webStore } from "./helpers/webStore";

export default function Home() {
  const [search, setSearch] = useState("bulbasaur");
  const dispatch = useDispatch();
  const [isScrolled, setIsScrolled] = useState(false);
  const { Pokemons, Pokemon, NextPage, PreviousPage, OpenCardPokemon } =
    useSelector((state) => state.pokemons);

  const divRef = useRef(null);

  function buscaPokemon(e) {
    e.preventDefault();
    dispatch(getPokemon(search.toLowerCase()));
  }

  function redirecionarParaDiv() {
    let div = document.getElementById("Pokemons");
    if (div) {
      setTimeout(() => {
        div.scrollIntoView();
      }, 500);
    }
  }

  useEffect(() => {
    function handleScroll() {
      const scrollHeight = window.innerHeight;
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;

      if (scrollTop >= scrollHeight) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    dispatch(getPokemons(9));
  }, []);

  // useEffect(() => {
  //   console.log(webStore.getData("Pokedex"))
  // }, []);

  return (
    <main>
      {OpenCardPokemon && (
        <div className="card-pokemon-box">
          <CardPokemon pokemon={Pokemon} />
        </div>
      )}
      <Container fluid className="bg-hero pb-5 mb-5">
        <Container className="py-5">
          <div className="d-flex align-items-center justify-content-center">
            <img
              draggable={false}
              width="300"
              src="/pokedexplore.svg"
              alt="PokédExplore"
            />
          </div>
          <Row className="align-items-center">
            <Col sm="12" xl="6" className="py-5 order-last order-lg-first">
              <h1>Ivysaur</h1>
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
                Ivysaur é a evolução do Bulbasaur, um Pokémon do tipo
                Grama/Veneno. Com sua semente em constante crescimento nas
                costas, ele utiliza habilidades como Vine Whip para atacar.
                Ivysaur é conhecido por sua lealdade, determinação e
                temperamento equilibrado. Sua evolução para Venusaur é aguardada
                por treinadores, pois se torna ainda mais poderoso. Um parceiro
                confiável, ideal para aqueles que buscam um Pokémon versátil e
                capaz de enfrentar diversos desafios com suas habilidades de
                planta e veneno.
              </p>
              <ButtonPrimary
                type="button"
                title="Mais detalhes"
                variant="w-100"
                icon={<Lightning size={24} weight="duotone" />}
                onClick={() => {
                  dispatch(getPokemon("ivysaur"));
                }}
              />
              <div className="d-flex gap-3 py-3">
                <Link
                  href="https://github.com/renatogsantos/pokedexplore"
                  target="_blank"
                  className="text-light"
                >
                  <GithubLogo size={32} weight="duotone" />
                </Link>
                <Link
                  href="https://www.linkedin.com/in/renato-g-santos/"
                  target="_blank"
                  className="text-light"
                >
                  <LinkedinLogo size={32} weight="duotone" />
                </Link>
                <Link
                  href="https://api.whatsapp.com/send?phone=5511911882402&text=Ol%C3%A1%20Renato,%20pode%20me%20ajudar?"
                  target="_blank"
                  className="text-light"
                >
                  <WhatsappLogo size={32} weight="duotone" />
                </Link>
              </div>
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
      </Container>

      <Container fluid className="m-0 py-4 bg-forest">
        <Container className="py-5">
          <Row id="Pokemons">
            <Col sm="12" lg="6">
              <span className="d-flex align-items-center gap-2 py-2">
                <Clipboard size={24} weight="duotone" /> Busque por tipo:
              </span>
              <div
                ref={divRef}
                className="main-card-scroll-x p-2"
                title="Pressione ALT para scrollar"
              >
                <button
                  type="button"
                  onClick={() => {
                    dispatch(getPokemons(9));
                  }}
                >
                  <House size={24} weight="duotone" color="#fff" />
                </button>
                {pokemonData.map((type) => {
                  return (
                    <button
                      key={type.type}
                      type="button"
                      onClick={() => {
                        dispatch(getTypesPokemons(type.type));
                      }}
                    >
                      <img
                        draggable={false}
                        width={30}
                        src={`/types/${type.type}.svg`}
                        alt={type.type}
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
              <form onSubmit={buscaPokemon}>
                <div className="d-flex">
                  <input
                    className="main-input"
                    placeholder="Eu escolho você!"
                    onChange={(e) => {
                      setSearch(e.target.value);
                    }}
                  />
                  <ButtonSecondary
                    type="submit"
                    icon={<MagnifyingGlass size={24} weight="duotone" />}
                  />
                </div>
              </form>
            </Col>
          </Row>
          <Row className="g-4 py-5">
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
                      id={""}
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
      <ButtonPrimary
        type="button"
        icon={<CaretUp size={24} weight="bold" />}
        variant={`button-back-top ${isScrolled ? "slide-in-top" : "d-none"}`}
        onClick={() => {
          redirecionarParaDiv();
        }}
      />
    </main>
  );
}
