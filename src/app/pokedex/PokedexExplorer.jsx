"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, GameController, MagnifyingGlass, Sparkle, Sword } from "@phosphor-icons/react";
import CardAddPokemon from "@/components/CardAddPokemon";
import CardPokemon from "@/components/CardPokemon";
import { pokemonData } from "@/helpers/PokemonTypes";
import { webStore } from "@/helpers/webStore";
import { getPokemon, getPokemonToPokedex, actAddPokedex, actOpenCardPokedex, actOpenCardPokemon } from "@/redux/pokemons";
import { getPokemonLevel, MAX_POKEMON_LEVEL } from "@/lib/pokemon/progression";

function getArtwork(pokemon) {
  return pokemon?.sprites?.other?.["official-artwork"]?.front_default || pokemon?.sprites?.other?.home?.front_default || "/pokenull.png";
}

function Ball({ size = 24 }) { return <img className="collection-ball-icon" src="/pokeball.png" width={size} height={size} alt="" />; }

function TypeBadge({ type }) {
  return <span className="collection-type"><img src={`/types/${type}.svg`} alt="" />{type}</span>;
}

function CollectionCard({ pokemon, onOpen, index }) {
  const types = pokemon.types?.map((item) => item.type?.name || item.name).filter(Boolean) || [];
  const primary = types[0] || "normal";
  const color = pokemonData.find((item) => item.type === primary)?.color || "#64748b";
  return <motion.button type="button" className="collection-card" style={{ "--type-color": color }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .025, .3) }} onClick={() => onOpen(pokemon.name)} aria-label={`Ver detalhes de ${pokemon.name}`}>
    <span className="collection-card-id">#{String(pokemon.id).padStart(3, "0")}</span>
    <span className="collection-level">Lv. {getPokemonLevel(pokemon)}</span>
    <img className="collection-art" src={getArtwork(pokemon)} alt="" loading="lazy" />
    <strong>{pokemon.name}</strong>
    <span className="collection-types">{types.map((type) => <TypeBadge key={type} type={type} />)}</span>
  </motion.button>;
}

export default function PokedexExplorer() {
  const dispatch = useDispatch();
  const { Pokedex, Pokemon, OpenCardPokedex, OpenCardPokemon } = useSelector((state) => state.pokemons);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  useEffect(() => { webStore.getData("Pokedex").then((collection) => dispatch(actAddPokedex(collection))); }, [dispatch]);

  const collection = Pokedex || [];
  const totalLevels = collection.reduce((sum, pokemon) => sum + getPokemonLevel(pokemon), 0);
  const filtered = useMemo(() => collection.filter((pokemon) => {
    const matchesName = pokemon.name.toLowerCase().includes(query.trim().toLowerCase());
    const types = pokemon.types?.map((item) => item.type?.name || item.name) || [];
    return matchesName && (selectedType === "all" || types.includes(selectedType));
  }).sort((a, b) => a.id - b.id), [collection, query, selectedType]);

  function closeCapture() { dispatch(actOpenCardPokedex(false)); }
  function closeDetail() { dispatch(actOpenCardPokemon(false)); }

  return <main className="collection-page">
    <a className="collection-skip" href="#collection-content">Ir para sua coleção</a>
    <header className="collection-header"><Link href="/" className="collection-back"><ArrowLeft size={20} aria-hidden="true" /> Início</Link><div className="collection-header-links"><Link href="/como-jogar">Como jogar</Link><Link href="/batalha">Batalhar</Link></div></header>
    <div className="collection-shell" id="collection-content">
      <section className="collection-hero"><div><span className="collection-eyebrow">SUA COLEÇÃO</span><h1>Pokédex</h1><p>Capture novos parceiros, fortaleça os repetidos e monte sua melhor equipe.</p><div className="collection-hero-actions"><button type="button" className="collection-capture" onClick={() => dispatch(getPokemonToPokedex())}><Ball size={23} /> Abrir Pokébola</button><Link href="/batalha" className="collection-battle"><Sword size={20} weight="fill" aria-hidden="true" /> Montar equipe</Link></div></div><div className="collection-hero-art" aria-hidden="true"><img src="/pokeball.png" alt="" /><img src="/pokemons/pikachu.png" alt="" /></div></section>
      <section className="collection-stats" aria-label="Resumo da coleção"><div><Ball size={24} /><strong>{collection.length}</strong><span>capturados</span></div><div><Sparkle weight="fill" aria-hidden="true" /><strong>{totalLevels}</strong><span>níveis somados</span></div><div><GameController weight="fill" aria-hidden="true" /><strong>{Math.min(collection.length, 3)} / 3</strong><span>prontos para lutar</span></div><div className="collection-progress"><span>Progresso da coleção</span><strong>{collection.length} de 1000</strong><i><b style={{ width: `${Math.min(collection.length / 10, 100)}%` }} /></i></div></section>
      <section className="collection-browser" aria-labelledby="collection-title"><div className="collection-browser-heading"><div><span className="collection-eyebrow">SEUS POKÉMON</span><h2 id="collection-title">{filtered.length === collection.length ? `${collection.length} na sua Pokédex` : `${filtered.length} encontrados`}</h2></div><button type="button" className="collection-capture mini" onClick={() => dispatch(getPokemonToPokedex())}><Ball size={19} /> Capturar</button></div>
        <div className="collection-controls"><label className="collection-search"><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Buscar Pokémon capturado</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na coleção" /></label><div className="collection-type-filters" aria-label="Filtrar por tipo"><button type="button" className={selectedType === "all" ? "selected" : ""} onClick={() => setSelectedType("all")}>Todos</button>{pokemonData.map((type) => <button type="button" key={type.type} title={type.type} className={selectedType === type.type ? "selected" : ""} onClick={() => setSelectedType(type.type)}><img src={`/types/${type.type}.svg`} alt={type.type} /></button>)}</div></div>
        {filtered.length > 0 ? <div className="collection-grid">{filtered.map((pokemon, index) => <CollectionCard key={pokemon.id} pokemon={pokemon} index={index} onOpen={(name) => dispatch(getPokemon(name))} />)}</div> : <div className="collection-empty"><img src="/pokeball.png" alt="" /><h3>{collection.length ? "Nenhum Pokémon encontrado" : "Sua Pokédex está esperando"}</h3><p>{collection.length ? "Tente outro nome ou tipo." : "Abra uma Pokébola para fazer sua primeira captura."}</p><button type="button" className="collection-capture" onClick={() => dispatch(getPokemonToPokedex())}><Ball size={21} /> Capturar Pokémon</button></div>}
      </section>
      <section className="collection-tip"><Sparkle size={28} weight="fill" aria-hidden="true" /><div><strong>Encontrar um repetido é uma boa notícia.</strong><span>Cada captura repetida aumenta 1 nível, até o nível {MAX_POKEMON_LEVEL}.</span></div><Link href="/como-jogar">Entender níveis</Link></section>
    </div>
    <AnimatePresence>{OpenCardPokedex && Pokemon && <div className="card-add-pokemon-box" onClick={closeCapture}><CardAddPokemon pokemon={Pokemon} /></div>}</AnimatePresence>
    <AnimatePresence>{OpenCardPokemon && Pokemon && <div className="card-pokemon-box" onClick={closeDetail}><CardPokemon pokemon={Pokemon} /></div>}</AnimatePresence>
  </main>;
}
