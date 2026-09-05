"use client";

import {
  ArrowsClockwise,
  Lightning,
  Shield,
  Sword,
  Trophy,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MOVES, multiplier } from "@/lib/battle/engine";
import { getPokemonArtwork, getReserveSprite } from "@/lib/battle/pokemon";
import { pokemonData } from "@/helpers/PokemonTypes";

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

function Fighter({ side, player, isHit, isAttacking }) {
  const pokemon = player.team[player.active];
  return (
    <div
      className={`combatant ${side} ${isHit ? "is-hit" : ""} ${isAttacking ? "is-attacking" : ""}`}
    >
      <div className="fighter-meta">
        <span className="combatant-label">
          {side === "player" ? "VOCÊ" : "ADVERSÁRIO"} · {player.name}
        </span>
        <h2>{pokemon.name}</h2>
        <div
          className="type-pill"
          style={{ backgroundColor: colorFor(pokemon.type) }}
        >
          {pokemon.type}
        </div>
        <HpBar pokemon={pokemon} />
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
  const me = state[role];
  const opponentRole = role === "host" ? "guest" : "host";
  const opponent = state[opponentRole];
  const myTurn = state.turn === role && state.status === "playing";
  const effect = state.effect;
  const active = me.team[me.active];
  const enemy = opponent.team[opponent.active];
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
            isHit={effect?.target === opponentRole}
            isAttacking={effect?.actor === opponentRole}
          />
          <div className="arena-divider">
            <span>VS</span>
          </div>
          <Fighter
            side="player"
            player={me}
            isHit={effect?.target === role}
            isAttacking={effect?.actor === role}
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
            const strong = multiplier(attackType, enemy.type) > 1;
            return (
              <button
                type="button"
                key={move.id}
                className={`attack-button ${strong ? "recommended" : ""}`}
                disabled={!myTurn}
                onClick={() => onAction({ type: "attack", moveId: move.id })}
              >
                <span className="attack-icon">
                  <Icon size={25} weight="fill" />
                </span>
                <span>
                  <strong>
                    {move.type === "own" ? `Golpe ${active.type}` : move.name}
                  </strong>
                  <small>{strong ? "Super efetivo" : attackType}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="switch-row">
          <span>Reserva</span>
          <div className="reserve-list">
            {me.team.map((pokemon, index) => (
              <button
                type="button"
                key={`${pokemon.id}-${index}`}
                className={`${index === me.active ? "selected active" : ""} ${pokemon.hp <= 0 ? "fainted" : ""}`}
                disabled={!myTurn || pokemon.hp <= 0 || index === me.active}
                onClick={() => onAction({ type: "switch", index })}
                aria-label={`Usar ${pokemon.name}`}
              >
                <img
                  className="reserve-sprite"
                  src={getReserveSprite(pokemon)}
                  alt={pokemon.name}
                />
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
        {state.status === "finished" && (
          <motion.div
            className="result-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="result-card"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
            >
              <Trophy size={42} weight="fill" />
              <span className="eyebrow">
                {state.winner === role ? "VOCÊ VENCEU" : "BOA BATALHA"}
              </span>
              <h2>{state.winner === role ? "Vitória!" : "Tente novamente"}</h2>
              <p>
                {state.winner === role
                  ? `${me.name} venceu esta batalha.`
                  : `${opponent.name} venceu desta vez.`}
              </p>
              <button
                type="button"
                className="rematch-button"
                onClick={onRematch}
              >
                <ArrowsClockwise size={20} /> Pedir revanche
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
