"use client";
import ButtonPrimary from "@/components/ButtonPrimary";
import { pokemonHome } from "@/helpers/PokemonHome";
import { getPokemon } from "@/redux/pokemons";
import {
  GithubLogo,
  Lightning,
  LinkedinLogo,
  WhatsappLogo,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch } from "react-redux";
import Waves from "../Waves";

export default function HomePokemon({ name }) {
  const dispatch = useDispatch();
  const Pokemon = pokemonHome.find((el) => el.name == name);

  return (
    <Container
      id="Home"
      fluid
      className={`bg-${Pokemon.name} pb-5 mb-5 position-relative overflow-hidden`}
    >
      <Waves />
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
            <h1 value="PokédExplore">{Pokemon.name}</h1>
            <div className="d-flex gap-2 mb-3 fade-in-top">
              {Pokemon.types.map((type) => {
                return (
                  <img
                    key={type}
                    draggable={false}
                    width={40}
                    src={`/types/${type}.svg`}
                    alt="Grass"
                  />
                );
              })}
            </div>
            <p className="mb-3">{Pokemon.description}</p>
            <ButtonPrimary
              type="button"
              title="Mais detalhes"
              variant="w-100"
              icon={<Lightning size={24} weight="duotone" />}
              onClick={() => {
                dispatch(getPokemon(Pokemon.name));
              }}
            />
            <div className="d-flex gap-3 py-3">
              <Link
                href="https://github.com/renatogsantos/pokedexplore"
                target="_blank"
                className="bg-color"
              >
                <GithubLogo size={32} weight="duotone" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/renato-g-santos/"
                target="_blank"
                className="bg-color"
              >
                <LinkedinLogo size={32} weight="duotone" />
              </Link>
              <Link
                href="https://api.whatsapp.com/send?phone=5511911882402&text=Ol%C3%A1%20Renato,%20pode%20me%20ajudar?"
                target="_blank"
                className="bg-color"
              >
                <WhatsappLogo size={32} weight="duotone" />
              </Link>
            </div>
          </Col>
          <Col sm="12" xl="6">
            <img
              draggable={false}
              width="100%"
              src={Pokemon.img}
              alt={Pokemon.img}
            />
          </Col>
        </Row>
      </Container>
    </Container>
  );
}
