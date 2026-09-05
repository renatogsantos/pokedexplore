"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowsClockwise, Lightning, Shield, Sword, Trophy } from "@phosphor-icons/react";
import Link from "next/link";
import { webStore } from "@/helpers/webStore";
import { pokemonData } from "@/helpers/PokemonTypes";
import { motion, AnimatePresence } from "framer-motion";
import "./style.scss";

const FALLBACK_TEAM = [
  { id: 25, name: "pikachu", types: [{ type: { name: "electric" } }], stats: [{ base_stat: 90, stat: { name: "hp" } }], sprites: { other: { "official-artwork": { front_default: "/pokemons/pikachu.png" } } } },
  { id: 6, name: "charizard", types: [{ type: { name: "fire" } }], stats: [{ base_stat: 100, stat: { name: "hp" } }], sprites: { other: { "official-artwork": { front_default: "/pokemons/charizard.png" } } } },
];

const OPPONENTS = [
  { id: 7, name: "squirtle", type: "water", hp: 100, image: "/pokemons/squirtle.png" },
  { id: 150, name: "mewtwo", type: "psychic", hp: 105, image: "/pokemons/mewtwo.png" },
  { id: 149, name: "lugia", type: "psychic", hp: 115, image: "/pokemons/lugia.png" },
];

const ATTACKS = [
  { name: "Investida", type: "normal", power: 15, icon: Sword },
  { name: "Golpe de tipo", type: "type", power: 23, icon: Lightning },
];

function typeColor(type) {
  return pokemonData.find((item) => item.type === type)?.color || "#64748b";
}

function imageOf(pokemon) {
  return pokemon?.sprites?.other?.["official-artwork"]?.front_default || pokemon?.image || "/pokenull.png";
}

function hpOf(pokemon) {
  return pokemon?.stats?.find((stat) => stat.stat.name === "hp")?.base_stat || 90;
}

function makePlayerPokemon(pokemon) {
  return { ...pokemon, maxHp: hpOf(pokemon), hp: hpOf(pokemon), type: pokemon.types?.[0]?.type?.name || "normal" };
}

export default function BattlePage() {
  const [team, setTeam] = useState([]);
  const [enemy, setEnemy] = useState(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [enemyHp, setEnemyHp] = useState(100);
  const [message, setMessage] = useState("Sua vez! Escolha um ataque.");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [battleKey, setBattleKey] = useState(0);

  const active = team[activeIndex];
  const remaining = team.filter((pokemon) => pokemon.hp > 0).length;
  const enemyType = enemy?.type || "water";
  const advantage = useMemo(() => {
    if (!active) return false;
    return (active.type === "electric" && enemyType === "water") ||
      (active.type === "water" && enemyType === "fire") ||
      (active.type === "fire" && enemyType === "grass");
  }, [active, enemyType]);

  useEffect(() => {
    let mounted = true;
    webStore.getData("Pokedex").then((saved) => {
      if (!mounted) return;
      const selected = (saved?.length ? saved : FALLBACK_TEAM).slice(0, 3).map(makePlayerPokemon);
      setTeam(selected);
      startBattle();
    });
    return () => { mounted = false; };
  }, [battleKey]);

  function startBattle() {
    const opponent = OPPONENTS[Math.floor(Math.random() * OPPONENTS.length)];
    setEnemy(opponent);
    setEnemyHp(opponent.hp);
    setActiveIndex(0);
    setResult(null);
    setBusy(false);
    setMessage("Sua vez! Escolha um ataque.");
  }

  function attack(attackData) {
    if (busy || result || !active || active.hp <= 0) return;
    setBusy(true);
    const damage = attackData.type === "type" && advantage ? attackData.power + 15 : attackData.power;
    const nextEnemyHp = Math.max(0, enemyHp - damage);
    setMessage(advantage && attackData.type === "type" ? "Super efetivo!" : `${active.name} atacou!`);
    setEnemyHp(nextEnemyHp);
    if (nextEnemyHp === 0) {
      setTimeout(() => { setResult("victory"); setMessage(`${enemy.name} foi derrotado!`); setBusy(false); }, 650);
      return;
    }
    setTimeout(() => opponentTurn(nextEnemyHp), 700);
  }

  function opponentTurn(currentEnemyHp) {
    const damage = Math.floor(10 + Math.random() * 10);
    const nextTeam = team.map((pokemon, index) => index === activeIndex ? { ...pokemon, hp: Math.max(0, pokemon.hp - damage) } : pokemon);
    const nextActiveHp = nextTeam[activeIndex].hp;
    setTeam(nextTeam);
    if (nextActiveHp === 0) {
      const nextIndex = nextTeam.findIndex((pokemon) => pokemon.hp > 0);
      if (nextIndex === -1) {
        setResult("defeat"); setMessage("Sua equipe deu tudo de si!"); setBusy(false); return;
      }
      setMessage(`${active.name} desmaiou. Escolha outro Pokémon.`);
      setActiveIndex(nextIndex);
    } else {
      setMessage(`${enemy.name} atacou. Sua vez!`);
    }
    setBusy(false);
  }

  function switchPokemon(index) {
    if (busy || result || index === activeIndex || !team[index] || team[index].hp <= 0) return;
    setActiveIndex(index);
    setMessage(`Vai, ${team[index].name}! Sua vez.`);
  }

  if (!enemy || !active) return <main className="battle-page"><div className="battle-loading">Preparando a arena...</div></main>;

  return (
    <main className="battle-page">
      <div className="battle-shell">
        <header className="battle-header">
          <Link href="/#pokedex" className="battle-back"><ArrowLeft size={20} /> Pokédex</Link>
          <div className="battle-title"><span>ARENA</span><h1>Batalha Pokémon</h1></div>
          <span className="battle-round">1 × 1</span>
        </header>

        <section className="battle-arena" aria-label="Arena de batalha">
          <div className="arena-status">{result ? "FIM DE BATALHA" : busy ? "VEZ DO OPONENTE" : "SUA VEZ"}</div>
          <div className="combatant opponent">
            <div className="combatant-copy"><span className="combatant-label">OPONENTE</span><h2>{enemy.name}</h2><div className="type-pill" style={{ backgroundColor: typeColor(enemyType) }}>{enemyType}</div><HpBar current={enemyHp} max={enemy.hp} /></div>
            <motion.img key={`${enemy.name}-${battleKey}`} animate={{ y: busy ? [0, -5, 0] : [0, -4, 0] }} transition={{ repeat: Infinity, duration: 2.8 }} src={imageOf(enemy)} alt={enemy.name} />
          </div>
          <div className="versus"><span>VS</span></div>
          <div className="combatant player">
            <motion.img key={`${active.name}-${activeIndex}-${battleKey}`} animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 2.4 }} src={imageOf(active)} alt={active.name} />
            <div className="combatant-copy"><span className="combatant-label">VOCÊ</span><h2>{active.name}</h2><div className="type-pill" style={{ backgroundColor: typeColor(active.type) }}>{active.type}</div><HpBar current={active.hp} max={active.maxHp} /></div>
          </div>
          <div className={`battle-message ${advantage ? "is-strong" : ""}`} role="status" aria-live="polite">{message}</div>
        </section>

        <section className="battle-controls">
          <div className="controls-heading"><div><span className="eyebrow">DECIDA RÁPIDO</span><h2>Escolha uma ação</h2></div><span className="team-left"><Shield size={18} /> {remaining} na equipe</span></div>
          <div className="attack-grid">{ATTACKS.map((attackData) => { const Icon = attackData.icon; return <button key={attackData.name} className={`attack-button ${attackData.type === "type" && advantage ? "recommended" : ""}`} disabled={busy || Boolean(result)} onClick={() => attack(attackData)}><span className="attack-icon"><Icon size={25} weight="fill" /></span><span><strong>{attackData.name}</strong>{attackData.type === "type" && advantage && <small>Super efetivo</small>}</span></button>; })}</div>
          <div className="switch-row"><span>Trocar Pokémon</span><div className="reserve-list">{team.map((pokemon, index) => <button key={pokemon.id || pokemon.name} className={index === activeIndex ? "selected" : ""} disabled={busy || Boolean(result) || pokemon.hp <= 0} onClick={() => switchPokemon(index)} aria-label={`Usar ${pokemon.name}`}><img src={imageOf(pokemon)} alt="" /><span>{pokemon.name}</span></button>)}</div></div>
        </section>

        <AnimatePresence>{result && <motion.div className="result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><motion.div className="result-card" initial={{ scale: .8, y: 20 }} animate={{ scale: 1, y: 0 }}><Trophy size={42} weight="fill" /><span className="eyebrow">{result === "victory" ? "VOCÊ VENCEU" : "BOA BATALHA"}</span><h2>{result === "victory" ? "Vitória!" : "Tente novamente"}</h2><p>{result === "victory" ? `${active.name} protegeu sua Pokédex.` : "Sua equipe deu o melhor. Uma nova batalha espera."}</p><button className="rematch-button" onClick={() => setBattleKey((key) => key + 1)}><ArrowsClockwise size={20} /> Nova batalha</button><Link href="/#pokedex" className="result-link">Voltar para a Pokédex</Link></motion.div></motion.div>}</AnimatePresence>
      </div>
    </main>
  );
}

function HpBar({ current, max }) {
  const percent = Math.max(0, (current / max) * 100);
  return <div className="hp-wrap"><div className="hp-label"><span>HP</span><strong>{current}/{max}</strong></div><div className="hp-track"><motion.div className={`hp-fill ${percent < 35 ? "danger" : ""}`} animate={{ width: `${percent}%` }} /></div></div>;
}
