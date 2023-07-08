"use client";

import axios from "axios";
import { useEffect, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
  getPokemon,
  getPokemons,
  nextPage,
  previousPage,
} from "./redux/pokemons";
import CardPoke from "./components/CardPoke";
import ButtonPrimary from "./components/ButtonPrimary";
import { ArrowCircleLeft, ArrowCircleRight } from "@phosphor-icons/react";

export default function Home() {
  const [initialPokemon, setInitialPokemon] = useState(
    Math.floor(Math.random() * 1000) + 1
  );
  const dispatch = useDispatch();
  const { Pokemons, Pokemon, NextPage, PreviousPage } = useSelector(
    (state) => state.pokemons
  );

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

  return (
    <main>
      <Container fluid className="py-5">
        <Container>
          <div className="d-flex align-items-center justify-content-center">
            <img width="300" src="/pokedexplore.svg" alt="PokédExplore" />
          </div>
          <Row className="align-items-center py-5">
            <Col sm="12" xl="4">
              <h1>PokédExplore</h1>
              <p>
                Bem-vindo(a) ao PokédExplore! Descubra todos os Pokémon e suas
                incríveis habilidades em um só lugar. Explore a vasta coleção de
                espécies, mergulhe nas estatísticas e conheça as estratégias
                para se tornar um mestre Pokémon. Aventure-se em nosso site e
                desvende os segredos dessas criaturas fascinantes. Prepare-se
                para embarcar em uma jornada inesquecível no mundo dos Pokémon!
              </p>
            </Col>
            <Col sm="12" xl="8">
              <img width="100%" src="/hero.png" />
            </Col>
          </Row>
        </Container>

        <Container>
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
