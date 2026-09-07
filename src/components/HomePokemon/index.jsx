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
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch } from "react-redux";
import Waves from "../Waves";
import PokemonTypeIcon from "@/components/PokemonTypeIcon";

export default function HomePokemon({ name }) {
  const dispatch = useDispatch();
  const Pokemon = pokemonHome.find((el) => el.name == name);

  return (
    <section
      id="Home"
      className={`home-hero bg-${Pokemon.name} position-relative overflow-hidden`}
    >
      <Waves />
      <Container className="home-hero__content">
        <div className="home-hero__brand">
          <img
            draggable={false}
            width="300"
            src="/pokedexplore.svg"
            alt="PokédExplore"
          />
        </div>
        <Row className="align-items-center home-hero__row">
          <Col sm="12" xl="6" className="home-hero__copy order-last order-lg-first">
            <span className="home-hero__eyebrow">Explore • Capture • Batalhe</span>
            <h1>{Pokemon.name}</h1>
            <div className="home-hero__types fade-in-top" aria-label={`Tipos: ${Pokemon.types.join(", ")}`}>
              {Pokemon.types.map((type) => {
                return (
                  <PokemonTypeIcon key={type} type={type} size={40} />
                );
              })}
            </div>
            <p className="home-hero__description">{Pokemon.description}</p>
            <div className="home-hero__actions">
              <Link href="#Pokemons" className="home-hero__explore">
                Explorar Pokémon <Lightning size={21} weight="fill" aria-hidden="true" />
              </Link>
            </div>
            <ButtonPrimary
              type="button"
              title={`Conhecer ${Pokemon.name}`}
              variant="home-hero__detail"
              icon={<Lightning size={20} weight="duotone" />}
              onClick={() => {
                dispatch(getPokemon(Pokemon.name));
              }}
            />
            <div className="home-hero__socials" aria-label="Redes e contato do projeto">
              <Link
                href="https://github.com/renatogsantos/pokedexplore"
                target="_blank"
                className="bg-color"
                aria-label="Abrir o GitHub do PokédExplore"
              >
                <GithubLogo size={32} weight="duotone" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/renato-g-santos/"
                target="_blank"
                className="bg-color"
                aria-label="Abrir o LinkedIn de Renato G Santos"
              >
                <LinkedinLogo size={32} weight="duotone" />
              </Link>
              <Link
                href="https://api.whatsapp.com/send?phone=5511911882402&text=Ol%C3%A1%20Renato,%20pode%20me%20ajudar?"
                target="_blank"
                className="bg-color"
                aria-label="Conversar pelo WhatsApp"
              >
                <WhatsappLogo size={32} weight="duotone" />
              </Link>
            </div>
          </Col>
          <Col sm="12" xl="6" className="home-hero__art">
            <img
              draggable={false}
              src={Pokemon.img}
              alt={Pokemon.name}
            />
          </Col>
        </Row>
      </Container>
    </section>
  );
}
