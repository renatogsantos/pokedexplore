"use client";

import { useEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
  actOpenCardPokemon,
  addPokemonCard,
  getPokemon,
  getPokemons,
  getTypesPokemons,
  nextPage,
  previousPage,
} from "../redux/pokemons";
import CardPoke from "../components/CardPoke";
import ButtonPrimary from "../components/ButtonPrimary";
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
import { pokemonData } from "../helpers/PokemonTypes";
import ButtonSecondary from "../components/ButtonSecondary";
import CardPokemon from "../components/CardPokemon";
import HomePokemon from "@/components/HomePokemon";
import { webStore } from "../helpers/webStore";
import { pokemonHome } from "@/helpers/PokemonHome";
import { gerarNumeroAleatorio, scrollTo } from "@/helpers";
import AliceCarousel from "react-alice-carousel";

export default function Home() {
  const dispatch = useDispatch();
  const [isScrolled, setIsScrolled] = useState(false);
  const [namePokemonHome, setNamePokemonHome] = useState("ivysaur");
  const [search, setSearch] = useState(namePokemonHome);
  const { Pokemons, Pokemon, NextPage, PreviousPage, OpenCardPokemon } =
    useSelector((state) => state.pokemons);
  const divRef = useRef(null);

  const handleDragStart = (e) => {
    e.preventDefault();
  };

  function getPokeHome() {
    let pokemon = pokemonHome.find((el) => el.name == Pokemon?.name);
    if (pokemon) {
      setNamePokemonHome(pokemon.name);
      scrollTo("Home");
    }
  }

  function buscaPokemon(e) {
    e.preventDefault();
    dispatch(getPokemon(search.toLowerCase()));
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

  useEffect(() => {
    getPokeHome();
  }, [Pokemon]);

  // useEffect(() => {
  //   console.log(webStore.getData("Pokedex"))
  // }, []);

  return (
    <main>
      {OpenCardPokemon && (
        <div
          className="card-pokemon-box"
          onClick={() => {
            dispatch(actOpenCardPokemon(false));
          }}
        >
          <CardPokemon pokemon={Pokemon} />
        </div>
      )}
      <HomePokemon name={namePokemonHome} />

      <Container fluid className="m-0 py-4 bg-forest">
        <Container className="py-5 text-light">
          <Row id="Pokemons">
            <Col sm="12" lg="6">
              <span className="d-flex align-items-center gap-2 py-2">
                <Clipboard size={24} weight="duotone" /> Busque por tipo:
              </span>
              <div ref={divRef} className="main-card-scroll-x p-2">
                <button
                  type="button"
                  onClick={() => {
                    dispatch(getPokemons(9));
                  }}
                >
                  <House size={24} weight="duotone" color="#fff" />
                </button>
                <AliceCarousel
                  mouseTracking={true}
                  autoWidth={true}
                  autoPlay={true}
                  autoPlayInterval={1500}
                  infinite={true}
                  disableButtonsControls={true}
                  disableDotsControls={true}
                  keyboardNavigation={true}
                  items={pokemonData.map((type) => {
                    return (
                      <div className="button-types px-1">
                        <button
                          draggable={false}
                          onDragStart={handleDragStart}
                          title={type.type}
                          key={type.type}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
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
                      </div>
                    );
                  })}
                />
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
                  type="search"
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
                  <div className="loading-block">
                    <CardPoke
                      id={pokemon.name}
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
                scrollTo("Pokemons");
              }}
            />
            <ButtonPrimary
              type="button"
              title="Próxima"
              icon={<ArrowCircleRight size={24} weight="duotone" />}
              onClick={() => {
                dispatch(nextPage(NextPage));
                scrollTo("Pokemons");
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
          scrollTo("Pokemons");
        }}
      />
    </main>
  );
}
