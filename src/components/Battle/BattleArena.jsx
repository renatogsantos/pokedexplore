"use client";

import {
  ArrowsClockwise,
  Lightning,
  Heart,
  Shield,
  Sword,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { MAX_POTIONS, MOVES, getOpponentWeaknesses, getPokemonMatchup, getPotionHealAmount, multiplier } from "@/lib/battle/engine";
import { getPokemonArtwork, getReserveSprite } from "@/lib/battle/pokemon";
import { pokemonData } from "@/helpers/PokemonTypes";
import { playBattleSound } from "@/lib/battle/sound";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { COINS_PER_WIN } from "@/lib/economy";

const iconFor = { strike: Sword, "type-strike": Lightning };
const colorFor = (type) =>
  pokemonData.find((item) => item.type === type)?.color || "#64748b";

function HpBar({ pokemon }) {
  const percent = Math.max(0, (pokemon.hp / pokemon.maxHp) * 100);
  return (
    <div className="hp-wrap">
      <div className="hp-label">
        <span>HP</span>
        <strong>
          {pokemon.hp}/{pokemon.maxHp}
        </strong>
      </div>
      <div className="hp-track">
        <motion.div
          className={`hp-fill ${percent < 35 ? "danger" : ""}`}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.42 }}
        />
      </div>
    </div>
  );
}

function Fighter({ side, player, isHit, isAttacking, isHealing, matchup }) {
  const pokemon = player.team[player.active];
  const weaknesses = side === "opponent" ? getOpponentWeaknesses(pokemon).slice(0, 3) : [];
  return (
    <div
      className={`combatant ${side} ${isHit ? "is-hit" : ""} ${isAttacking ? "is-attacking" : ""} ${isHealing ? "is-healing" : ""} ${getRarityClassName(pokemon)}`}
    >
      <div className="fighter-meta">
        <span className="combatant-label">
          {side === "player" ? "VOCÊ" : "ADVERSÁRIO"} · {player.name}
        </span>
        <h2>{pokemon.name}</h2>
        <div className="fighter-tags">
          <span className="fighter-level">Lv. {pokemon.level || 1}</span>
          <PokemonRarity pokemon={pokemon} />
          <div className="type-pill" style={{ backgroundColor: colorFor(pokemon.type) }}>{pokemon.type}</div>
        </div>
        <HpBar pokemon={pokemon} />
        {side === "player" && matchup === "disadvantage" && <small className="matchup-warning">Desvantagem de tipo</small>}
        {weaknesses.length > 0 && <small className="weakness-hint">Fraco contra: {weaknesses.join(", ")}</small>}
      </div>
      <div className="fighter-art">
        <motion.img
          animate={{ y: [0, -5, 0] }}
          transition={{
            repeat: Infinity,
            duration: side === "player" ? 2.4 : 2.8,
          }}
          src={getPokemonArtwork(pokemon)}
          alt={pokemon.name}
        />
        <span className="fighter-shadow" />
      </div>
    </div>
  );
}

function BattleNotification({ state, role, opponentName }) {
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (state.effect?.kind === "attack") playBattleSound("dano", 0.5);
    if (state.effect?.kind === "potion") playBattleSound("healing-pokemon-sound", 0.5);
    if (state.status === "finished") playBattleSound(state.winner === role ? "win" : "lost", 0.62);
    if (state.status === "countdown")
      setNotification({ title: "3 · 2 · 1", detail: "BATALHA!", tone: "turn" });
    else if (state.status === "finished")
      setNotification({
        title: "BATALHA ENCERRADA",
        detail: state.log,
        tone: "result",
      });
    else if (state.effect?.kind === "attack")
      setNotification({
        title: `-${state.effect.damage}`,
        detail: state.effect.effective ? "SUPER EFETIVO!" : state.log,
        tone: state.effect.effective ? "strong" : "damage",
      });
    else if (state.effect?.kind === "potion")
      setNotification({
        title: `+${state.effect.healing} HP`,
        detail: "POÃ‡ÃƒO! RECUPEROU VIDA!",
        tone: "healing",
      });
    else if (state.effect?.kind === "switch")
      setNotification({ title: "TROCA!", detail: state.log, tone: "turn" });
    else if (state.turn === role)
      setNotification({
        title: "SUA VEZ!",
        detail: "Escolha um ataque",
        tone: "turn",
      });
    else
      setNotification({
        title: `VEZ DE ${opponentName.toUpperCase()}`,
        detail: "Aguardando adversário...",
        tone: "waiting",
      });
    const timer = setTimeout(
      () => setNotification(null),
      state.status === "countdown" ? 1450 : 1050,
    );
    return () => clearTimeout(timer);
  }, [
    state.revision,
    state.status,
    state.effect?.kind,
    state.turn,
    state.log,
    role,
    opponentName,
  ]);
  return (
    <AnimatePresence mode="wait">
      {notification && (
        <div className="battle-notification-anchor">
          <motion.div
            key={`${state.revision}-${notification.title}-${state.status}`}
            className={`battle-notification ${notification.tone}`}
            initial={{ opacity: 0, scale: 0.72, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.08, y: -10 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
          >
            <strong>{notification.title}</strong>
            <span>{notification.detail}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default function BattleArena({ state, role, onAction, onRematch }) {
  const [isPotionOpen, setIsPotionOpen] = useState(false);
  const coins = useSelector((store) => store.economy.coins);
  const me = state[role];
  const opponentRole = role === "host" ? "guest" : "host";
  const opponent = state[opponentRole];
  const myTurn = state.turn === role && state.status === "playing";
  const effect = state.effect;
  const active = me.team[me.active];
  const enemy = opponent.team[opponent.active];
  const potionsRemaining = me.potionsRemaining ?? MAX_POTIONS;
  const hasPotionTarget = me.team.some((pokemon) => pokemon.hp > 0 && pokemon.hp < pokemon.maxHp);
  const activeMatchup = getPokemonMatchup(active, enemy);
  return (
    <>
      <section
        className={`battle-arena arena-${myTurn ? "ready" : "waiting"}`}
        aria-label="Arena de batalha"
      >
        <div className="persistent-turn" aria-hidden="true">
          {myTurn
            ? "SUA VEZ"
            : state.status === "countdown"
              ? "PREPARE-SE"
              : `VEZ DE ${opponent.name.toUpperCase()}`}
        </div>
        <div className="arena-stage">
          <Fighter
            side="opponent"
            player={opponent}
            isHit={effect?.kind === "attack" && effect?.target === opponentRole}
            isAttacking={effect?.actor === opponentRole}
            isHealing={effect?.kind === "potion" && effect?.target === opponentRole && effect?.targetPokemonId === opponent.team[opponent.active].id}
          />
          <div className="arena-divider">
            <span>VS</span>
          </div>
          <Fighter
            side="player"
            player={me}
            isHit={effect?.kind === "attack" && effect?.target === role}
            isAttacking={effect?.actor === role}
            isHealing={effect?.kind === "potion" && effect?.target === role && effect?.targetPokemonId === me.team[me.active].id}
            matchup={activeMatchup}
          />
        </div>
        <BattleNotification
          state={state}
          role={role}
          opponentName={opponent.name}
        />
      </section>
      <section className={`battle-controls ${myTurn ? "is-active" : ""}`}>
        <div className="controls-heading">
          <div>
            <span className="eyebrow">
              {myTurn ? "O QUE VOCÊ VAI FAZER?" : "BATALHA EM CURSO"}
            </span>
            <h2>
              {myTurn ? "Escolha uma ação" : `Aguardando ${opponent.name}...`}
            </h2>
          </div>
          <span className="team-left">
            <Shield size={18} />{" "}
            {me.team.filter((pokemon) => pokemon.hp > 0).length} disponíveis
          </span>
        </div>
        <div className="attack-grid">
          {MOVES.map((move) => {
            const Icon = iconFor[move.id];
            const attackType = move.type === "own" ? active.type : move.type;
            const strong = multiplier(attackType, enemy) > 1;
            const weak = multiplier(attackType, enemy) < 1;
            const uses = active.specialAttackUsesRemaining ?? 0;
            return (
              <button
                type="button"
                key={move.id}
                className={`attack-button ${strong ? "recommended" : ""} ${weak ? "disadvantage" : ""}`}
                disabled={!myTurn || (move.special && uses <= 0)}
                onClick={() => {
                  playBattleSound(move.id === "strike" ? "investida" : "golpe-normal");
                  onAction({ type: "attack", moveId: move.id });
                }}
              >
                <span className="attack-icon">
                  <Icon size={25} weight="fill" />
                </span>
                <span>
                  <strong>
                    {move.type === "own" ? `Golpe ${active.type}` : move.name}
                  </strong>
                  <small>{move.special ? uses <= 0 ? "Esgotado" : `${uses}/2 especial` : strong ? "Vantagem" : weak ? "Desvantagem" : "Ilimitado"}</small>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="potion-action"
          disabled={!myTurn || potionsRemaining <= 0 || !hasPotionTarget}
          onClick={() => setIsPotionOpen(true)}
          aria-haspopup="dialog"
        >
          <Heart size={22} weight="fill" />
          <span>Usar po{"\u00e7"}{"\u00e3"}o</span>
          <strong>{potionsRemaining} {potionsRemaining === 1 ? "restante" : "restantes"}</strong>
        </button>
        <div className="switch-row">
          <span>Reserva</span>
          <div className="reserve-list">
            {me.team.map((pokemon, index) => (
              <button
                type="button"
                key={`${pokemon.id}-${index}`}
                className={`${index === me.active ? "selected active" : ""} ${pokemon.hp <= 0 ? "fainted" : ""} ${getPokemonMatchup(pokemon, enemy)} ${getRarityClassName(pokemon)} ${effect?.kind === "potion" && effect?.target === role && effect?.targetPokemonId === pokemon.id ? "is-healing" : ""}`}
                disabled={!myTurn || pokemon.hp <= 0 || index === me.active}
                onClick={() => onAction({ type: "switch", index })}
                aria-label={`Usar ${pokemon.name}`}
              >
                <img
                  className="reserve-sprite"
                  src={getReserveSprite(pokemon)}
                  alt={pokemon.name}
                />
                <PokemonRarity pokemon={pokemon} compact />
                <span>{pokemon.name}</span>
                <small>
                  {index === me.active
                    ? "ativo"
                    : pokemon.hp <= 0
                      ? "desmaiado"
                      : "reserva"}
                </small>
              </button>
            ))}
          </div>
        </div>
      </section>
      <AnimatePresence>
        {isPotionOpen && (
          <motion.div className="potion-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="presentation">
            <motion.section className="potion-selector" role="dialog" aria-modal="true" aria-labelledby="potion-title" initial={{ opacity: 0, y: 14, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 14, scale: .96 }}>
              <div className="potion-selector-heading"><div><span className="eyebrow">PO{"\u00c7"}{"\u00c3"}O Ã—{potionsRemaining}</span><h2 id="potion-title">Usar po{"\u00e7"}{"\u00e3"}o em</h2></div><button type="button" onClick={() => setIsPotionOpen(false)} aria-label="Fechar seletor de poção">×</button></div>
              <div className="potion-target-list">
                {me.team.map((pokemon, index) => {
                  const healing = getPotionHealAmount(pokemon);
                  const unavailable = pokemon.hp <= 0 || pokemon.hp >= pokemon.maxHp;
                  return <button type="button" key={`${pokemon.id}-${index}`} disabled={unavailable} onClick={() => { setIsPotionOpen(false); onAction({ type: "potion", targetPokemonId: pokemon.id }); }}><img src={getReserveSprite(pokemon)} alt="" /><span><strong>{pokemon.name}</strong><small>{pokemon.hp <= 0 ? "DESMAIADO" : pokemon.hp >= pokemon.maxHp ? "HP CHEIO" : `${pokemon.hp} / ${pokemon.maxHp}  +${healing} HP`}</small></span></button>;
                })}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {state.status === "finished" && (
          <motion.div
            className="result-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className={`result-card ${state.winner === role ? "is-victory" : "is-defeat"}`}
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
            >
              {state.winner === role ? <Trophy size={42} weight="fill" /> : <WarningCircle size={42} weight="fill" />}
              <span className="eyebrow">
                {state.winner === role ? "VOCÊ VENCEU" : "BOA BATALHA"}
              </span>
              <h2>{state.winner === role ? "Vitória!" : "Tente novamente"}</h2>
              <p>
                {state.winner === role
                  ? `${me.name} venceu esta batalha.`
                  : `${opponent.name} venceu desta vez.`}
              </p>
              {state.winner === role && <div className="result-reward" aria-live="polite"><img src="/coin.png" alt="" aria-hidden="true" /><div><strong>+{COINS_PER_WIN} moedas</strong><span>Saldo: {coins}</span></div></div>}
              <button
                type="button"
                className="rematch-button"
                onClick={onRematch}
              >
                <ArrowsClockwise size={20} /> Pedir revanche
              </button>
              {state.winner === role && <Link href="/loja" className="result-link">Ir para a Loja Pokémon</Link>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
