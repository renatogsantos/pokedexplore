"use client";
import { useEffect, useRef, useState } from "react";
import { Col, Container, Row } from "react-bootstrap";
import { useDispatch, useSelector } from "react-redux";
import {
  actOpenCardPokedex,
  actOpenCardPokemon,
  getPokemon,
  getPokemonToPokedex,
  getPokemons,
  getTypesPokemons,
} from "../redux/pokemons";
import CardPoke from "../components/CardPoke";
import ButtonPrimary from "../components/ButtonPrimary";
import {
  CaretUp,
  Clipboard,
  GithubLogo,
  House,
  LinkedinLogo,
  MagnifyingGlass,
  ShoppingCart,
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
import CardAddPokemon from "@/components/CardAddPokemon";
import PokemonTypeIcon from "@/components/PokemonTypeIcon";
import Link from "next/link";
import Paginate from "@/components/Paginate";
import { AnimatePresence, motion } from "framer-motion";
import { actCoins } from "@/redux/economy";
import { SECRET_REWARD_COINS, SECRET_REWARD_ID, advancePokemonSecret } from "@/lib/easter-egg/pokemonSequence";
import { formatCoins } from "@/lib/economy";

export default function Home() {
  const dispatch = useDispatch();
  const [pokeball, setPokeball] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [namePokemonHome, setNamePokemonHome] = useState("charizard");
  const [search, setSearch] = useState(namePokemonHome);
  const {
    Pokemons,
    Pokemon,
    OpenCardPokemon,
    OpenCardPokedex,
  } = useSelector((state) => state.pokemons);
  const divRef = useRef(null);
  const secretProgress = useRef({ index: 0, lastInputAt: 0 });
  const [secretReward, setSecretReward] = useState(false);

  const handleDragStart = (e) => {
    e.preventDefault();
  };

  function getPokeHome() {
    let pokemon = pokemonHome.find((el) => el.name == Pokemon?.name);
    if (pokemon) {
      setNamePokemonHome(pokemon.name);
    }
  }

  function buscaPokemon(e) {
    e.preventDefault();
    dispatch(getPokemon(search.toLowerCase()));
  }

  async function handleHomePokemonOpen(id) {
    const next = advancePokemonSecret(secretProgress.current, Number(id));
    secretProgress.current = next.progress;
    if (process.env.NODE_ENV !== "production") console.info(`[EasterEgg] input Pokémon #${id} — progress ${next.unlocked ? 6 : next.progress.index}/6`);
    if (!next.unlocked) return;
    if (process.env.NODE_ENV !== "production") console.info("[EasterEgg] secret unlocked");
    const reward = await webStore.claimSecretReward(SECRET_REWARD_ID, SECRET_REWARD_COINS);
    if (!reward.claimed) return;
    dispatch(actCoins(reward.coins));
    setSecretReward(true);
    if (process.env.NODE_ENV !== "production") console.info("[EasterEgg] reward persisted");
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
    getPokeHome();
  }, [Pokemon]);

  useEffect(() => {
    const num = gerarNumeroAleatorio(1000);
    setTimeout(() => {
      setPokeball(true);
    }, num * 60);
  }, [pokeball]);

  useEffect(() => {
    OpenCardPokedex == false && setPokeball(false);
  }, [OpenCardPokedex]);

  useEffect(() => {
    dispatch(getPokemons(9));
  }, []);

  return (
    <main>
      {pokeball && (
        <button
          type="button"
          className="shake-bottom button-pokeball"
          onClick={() => {
            dispatch(getPokemonToPokedex());
          }}
        >
          <img
            loading="lazy"
            draggable={false}
            width="60"
            src="/pokeball.png"
            alt="Pokeball"
          />
        </button>
      )}

      <AnimatePresence>
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
      </AnimatePresence>

      <AnimatePresence>
        {secretReward && <motion.div className="secret-reward-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section role="dialog" aria-modal="true" aria-labelledby="secret-reward-title" initial={{ opacity: 0, scale: .84, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: .9, y: 16 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}><div className="secret-coin-burst" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <img key={index} src="/coin.png" alt="" />)}</div><span>SEGREDO DESCOBERTO!</span><h2 id="secret-reward-title">Você descobriu um segredo do Pokédex!</h2><strong><img src="/coin.png" alt="" /> +{formatCoins(SECRET_REWARD_COINS)}</strong><button type="button" onClick={() => setSecretReward(false)}>Continuar</button></motion.section></motion.div>}
      </AnimatePresence>

      <AnimatePresence>
        {OpenCardPokedex && (
          <div
            className="card-add-pokemon-box"
            onClick={() => {
              dispatch(actOpenCardPokedex(false));
              setPokeball(false);
            }}
          >
            <CardAddPokemon pokemon={Pokemon} />
          </div>
        )}
      </AnimatePresence>

      <HomePokemon name={namePokemonHome} />

      <Container className="project-intro text-light">
        <section className="project-intro__panel" aria-labelledby="project-intro-title">
          <Row className="align-items-center g-0">
            <Col sm="12" lg="4" className="d-flex align-items-center justify-content-center project-intro__art">
              <img
                loading="lazy"
                draggable={false}
                src="/pokemons/treinador-pk.png"
                width="100%"
                alt="Treinador pokemon"
              />
            </Col>
            <Col sm="12" lg="8" className="project-intro__content">
              <span className="project-intro__eyebrow">Sua jornada começa aqui</span>
              <h2 id="project-intro-title">Capture, monte sua equipe e entre na arena.</h2>
              <p>Encontre Pokémon, registre cada descoberta na sua Pokédex e prepare um time para enfrentar a CPU.</p>
              <div className="project-intro__steps" aria-label="Como começar no PokédExplore">
                <span><b>01</b> Capture</span>
                <span><b>02</b> Evolua sua coleção</span>
                <span><b>03</b> Batalhe</span>
              </div>
              <div className="project-intro__actions">
                <Link href="/pokedex" className="project-intro__primary">Explorar Pokédex</Link>
                <Link href="/como-jogar" className="project-intro__secondary">Como jogar</Link>
              </div>
            </Col>
          </Row>
        </section>
      </Container>

      <Container className="home-destinations text-light">
        <section aria-labelledby="home-destinations-title">
          <div className="home-destinations__heading">
            <span>SEU PRÓXIMO PASSO</span>
            <h2 id="home-destinations-title">Escolha como continuar sua jornada.</h2>
          </div>
          <div className="home-destinations__grid">
            <Link href="#Pokemons" className="home-destination home-destination--discover">
              <MagnifyingGlass size={26} weight="duotone" aria-hidden="true" />
              <div><strong>Explorar Pokémon</strong><small>Busque por nome ou tipo</small></div>
              <span aria-hidden="true">01</span>
            </Link>
            <Link href="/loja" className="home-destination home-destination--shop">
              <ShoppingCart size={26} weight="duotone" aria-hidden="true" />
              <div><strong>Fortalecer equipe</strong><small>Compre cópias na Loja</small></div>
              <span aria-hidden="true">02</span>
            </Link>
          </div>
        </section>
      </Container>

      <Container fluid className="m-0 py-4">
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
                          <PokemonTypeIcon type={type.type} size={30} />
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
                      id={pokemon.id}
                      name={pokemon.name}
                      img={
                        pokemon.sprites.other["official-artwork"].front_default
                          ? pokemon.sprites.other["official-artwork"]
                              .front_default
                          : pokemon.sprites.other.home.front_default
                          ? pokemon.sprites.other.home.front_default
                          : "pokenull.png"
                      }
                      types={pokemon.types}
                      height={pokemon.height}
                      weight={pokemon.weight}
                      onOpen={handleHomePokemonOpen}
                    />
                  </div>
                </Col>
              );
            })}
          </Row>
          <div className="d-flex align-items-center justify-content-center w-100">
            <Paginate page={0} />
          </div>
        </Container>
        <Container>
          <div className="main-card d-flex align-items-center justify-content-between flex-column flex-lg-row p-1 px-4">
            <div className="d-none d-lg-flex flex-column py-3">
              <span>Renato G Santos</span>
              <small>
                <Link href="mailto:renato.work.art@gmail.com" className="link">
                  renato.work.art@gmail.com
                </Link>
              </small>
            </div>
            <div className="d-flex gap-3 py-3">
              <Link
                href="https://github.com/renatogsantos/pokedexplore"
                target="_blank"
                className="link"
              >
                <GithubLogo size={32} weight="duotone" />
              </Link>
              <Link
                href="https://www.linkedin.com/in/renato-g-santos/"
                target="_blank"
                className="link"
              >
                <LinkedinLogo size={32} weight="duotone" />
              </Link>
              <Link
                href="https://api.whatsapp.com/send?phone=5511911882402&text=Ol%C3%A1%20Renato,%20pode%20me%20ajudar?"
                target="_blank"
                className="link"
              >
                <WhatsappLogo size={32} weight="duotone" />
              </Link>
            </div>
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
