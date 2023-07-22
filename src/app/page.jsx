"use client";

import { useEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
  actAddPokedex,
  actOpenCardPokedex,
  actOpenCardPokemon,
  addPokemonCard,
  getPokemon,
  getPokemonToPokedex,
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
  House,
  Lightning,
  LinkedinLogo,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { pokemonData } from "../helpers/PokemonTypes";
import ButtonSecondary from "../components/ButtonSecondary";
import CardPokemon from "../components/CardPokemon";
import HomePokemon from "@/components/HomePokemon";
import { webStore } from "../helpers/webStore";
import { pokemonHome } from "@/helpers/PokemonHome";
import { gerarNumeroAleatorio, scrollTo } from "@/helpers";
import AliceCarousel from "react-alice-carousel";
import CardAddPokemon from "@/components/CardAddPokemon";
import CardPokedex from "@/components/CardPokedex";
import Link from "next/link";
import { getPokemonPage } from "@/services/pokemons";

export default function Home() {
  const dispatch = useDispatch();
  const [pokeball, setPokeball] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [namePokemonHome, setNamePokemonHome] = useState("ivysaur");
  const [search, setSearch] = useState(namePokemonHome);
  const {
    Pokemons,
    Pokemon,
    NextPage,
    PreviousPage,
    OpenCardPokemon,
    OpenCardPokedex,
    Pokedex,
  } = useSelector((state) => state.pokemons);
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

  useEffect(() => {
    const num = gerarNumeroAleatorio(60000);
    setTimeout(() => {
      setPokeball(true);
    }, num * 5);
  }, [NextPage, PreviousPage]);

  useEffect(() => {
    OpenCardPokedex == false && setPokeball(false);
  }, [OpenCardPokedex]);

  useEffect(() => {
    dispatch(actAddPokedex(webStore.getData("Pokedex")));
  }, []);

  useEffect(() => {
    getPokemonPage(1);
  }, []);

  return (
    <main>
      {OpenCardPokemon && (
        <div
          className={`card-pokemon-box`}
          onClick={() => {
            dispatch(actOpenCardPokemon(false));
          }}
        >
          <CardPokemon pokemon={Pokemon} />
        </div>
      )}

      {pokeball && (
        <button
          type="button"
          className="shake-bottom button-pokeball"
          onClick={() => {
            dispatch(getPokemonToPokedex());
          }}
        >
          <img width="60" src="/pokeball.png" alt="Pokeball" />
        </button>
      )}

      {OpenCardPokedex && (
        <div
          className="card-pokemon-box"
          onClick={() => {
            dispatch(actOpenCardPokedex(false));
            setPokeball(false);
          }}
        >
          <CardAddPokemon pokemon={Pokemon} />
        </div>
      )}

      <HomePokemon name={namePokemonHome} />

      <Container className="py-5 text-light text-center">
        <img
          draggable={false}
          src="/pokemons/treinador-pk.png"
          width="80%"
          alt="Treinador pokemon"
        />
        <h2 className="py-4">
          Viva a emoção de capturar e batalhar: Seja um mestre Pokémon no
          PokédExplore!
        </h2>
        <p>
          Descubra um mundo repleto de aventuras com o PokédExplore! Agora, você
          pode se tornar um verdadeiro treinador Pokémon, capturando suas
          criaturas favoritas com apenas um clique. Espere a pokebola surgir,
          clique e encare um Pokémon surpresa para adicionar à sua pokédex.
          Monte um poderoso deck e desafie seus amigos em empolgantes batalhas!
          A jornada começa agora. Prepare-se para ser o melhor treinador de
          todos os tempos!
        </p>
      </Container>

      <Container>
        <div id="pokedex" className="d-flex align-items-center gap-2 my-3">
          <img
            draggable={false}
            src="/pokeball.png"
            width="32"
            alt="Pokeball"
          />
          <h2 className="text-light m-0">Pokédex</h2>
        </div>
        <div className="pokedex-list" title="Ctrl + scroll para navegar.">
          <img draggable={false} src="/pokedex.png" width="60" alt="Pokedex" />
          {Pokedex?.map((pk, i) => {
            return <CardPokedex key={i} pokemon={pk} />;
          })}
        </div>
      </Container>

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
                  items={pokemonData.map((type, i) => {
                    return (
                      <div key={i} className="button-types px-2">
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
                      setSearch(e.target.value ? e.target.value : "2");
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
                      img={
                        pokemon.sprites.other.home.front_default
                          ? pokemon.sprites.other.home.front_default
                          : pokemon.sprites.other["official-artwork"]
                              .front_default
                          ? pokemon.sprites.other["official-artwork"]
                              .front_default
                          : "pokenull.png"
                      }
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
