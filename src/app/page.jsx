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
      <Container className="py-5">
        <div className="d-flex align-items-center justify-content-center">
          <img width="300" src="/pokedexplore.svg" alt="PokédExplore" />
        </div>
        <Row className="align-items-center py-5 d-none">
          <Col sm="12" xl="5">
            {Pokemon && (
              <div>
                <img
                  width="100%"
                  src={Pokemon.data?.sprites.other.home.front_default}
                />
              </div>
            )}
          </Col>
          <Col sm="12" xl="7">
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Temporibus
            quae illum debitis ipsum esse voluptate, amet eveniet provident
            distinctio rem vero voluptatum enim ullam obcaecati sint est numquam
            aspernatur non cumque iusto culpa. Omnis reprehenderit officia
            necessitatibus ex, eligendi molestiae enim minima blanditiis neque
            praesentium quasi fugit cum! Nulla illo vel voluptatem architecto,
            odit perspiciatis quae cumque qui totam hic magni iste repellat,
            quisquam ipsam? Sunt dicta nisi quos rerum asperiores vitae repellat
            porro error fugit, ipsam, ullam assumenda vel libero perferendis,
            nobis consequatur neque quis. Voluptates soluta repellendus voluptas
            officia omnis qui rerum consequuntur, minus quas vero illo! Velit,
            fuga maxime rem atque obcaecati cumque repellat? Tempore, eos a
            minima ratione optio porro necessitatibus, saepe provident tenetur
            at, suscipit libero. Obcaecati eveniet fugiat minus placeat amet id
            nostrum, eligendi qui dignissimos architecto officia possimus quasi,
            error beatae exercitationem dolorem accusantium iure. Neque
            distinctio necessitatibus rerum explicabo voluptatem ducimus ipsam!
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
        <div className="d-flex align-items-center justify-content-between w-100 mb-5">
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
    </main>
  );
}
