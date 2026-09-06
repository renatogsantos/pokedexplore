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
import {
  BATTLE_BAG,
  getOpponentWeaknesses,
  getPokemonMatchup,
  getPotionHealAmount,
  getSupportedAbility,
  multiplier,
} from "@/lib/battle/engine";
import { getPokemonArtwork, getReserveSprite } from "@/lib/battle/pokemon";
import { pokemonData } from "@/helpers/PokemonTypes";
import { playBattleSound } from "@/lib/battle/sound";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { calculateBattleRewards } from "@/lib/battle/rewards";
import PokemonTypeIcon from "@/components/PokemonTypeIcon";

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

const STATUS_LABELS = {
  burn: "Queimado",
  poison: "Envenenado",
  paralysis: "Paralisado",
  sleep: "Dormindo",
};

function useBattleElapsed(startedAt, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !startedAt) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  return startedAt ? Math.max(0, now - startedAt) : 0;
}

function Fighter({ side, player, isHit, isAttacking, isHealing, matchup }) {
  const pokemon = player.team[player.active];
  const ability = getSupportedAbility(pokemon.ability);
  const weaknesses = side === "opponent" ? getOpponentWeaknesses(pokemon) : [];
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
          <div
            className="type-pill"
            style={{ backgroundColor: colorFor(pokemon.type) }}
          >
            {pokemon.type}
          </div>
        </div>
        <HpBar pokemon={pokemon} />
        {ability && (
          <span className="battle-ability" title={ability.description}>
            {ability.id}
          </span>
        )}
        {pokemon.status && (
          <span className={`battle-status is-${pokemon.status.id}`}>
            {STATUS_LABELS[pokemon.status.id] || pokemon.status.id}
          </span>
        )}
        {side === "player" && matchup === "disadvantage" && (
          <small className="matchup-warning">Desvantagem de tipo</small>
        )}
        {weaknesses.length > 0 && (
          <div className="weakness-hint" aria-label="Fraquezas">
            <span>Fraco contra:</span>
            <span className="weakness-icons">
              {weaknesses.map((weakness) => (
                <PokemonTypeIcon
                  key={weakness}
                  type={weakness}
                  size={26}
                  label={`Fraco contra ${weakness}`}
                  interactive
                />
              ))}
            </span>
          </div>
        )}
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
    if (state.effect?.kind === "potion")
      playBattleSound("healing-pokemon-sound", 0.5);
    if (state.status === "finished")
      playBattleSound(state.winner === role ? "win" : "lost", 0.62);
    if (state.status === "countdown")
      setNotification({ title: "3 · 2 · 1", detail: "BATALHA!", tone: "turn" });
    else if (state.status === "finished")
      setNotification({
        title: "BATALHA ENCERRADA",
        detail: state.log,
        tone: "result",
      });
    else if (state.effect?.ability)
      setNotification({
        title: state.effect.ability.toUpperCase() + "!",
        detail: "Habilidade ativada",
        tone: "strong",
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
  const [isBagOpen, setIsBagOpen] = useState(false);
  const [isSwitchOpen, setIsSwitchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const coins = useSelector((store) => store.economy.coins);
  const me = state[role];
  const opponentRole = role === "host" ? "guest" : "host";
  const opponent = state[opponentRole];
  const myTurn = state.turn === role && state.status === "playing";
  const effect = state.effect;
  const active = me.team[me.active];
  const enemy = opponent.team[opponent.active];
  const bag = me.bag || { potion: me.potionsRemaining || 0, "full-heal": 0 };
  const potionsRemaining = bag.potion;
  const selectedBagItem =
    selectedItem || (potionsRemaining ? "potion" : "full-heal");
  const setIsPotionOpen = setIsBagOpen;
  const hasPotionTarget = me.team.some(
    (pokemon) => pokemon.hp > 0 && pokemon.hp < pokemon.maxHp,
  );
  const activeMatchup = getPokemonMatchup(active, enemy);
  const elapsed = useBattleElapsed(
    state.performance?.startedAt,
    state.status === "playing",
  );
  const fastAvailable = elapsed < 60_000;
  const onePokemonAvailable = !state.performance?.players?.[role]?.hasSwitched;
  const victoryReward = calculateBattleRewards({
    won: state.status === "finished" && state.winner === role,
    durationMs:
      (state.performance?.endedAt || 0) - (state.performance?.startedAt || 0),
    usedOnlyOnePokemon: !state.performance?.players?.[role]?.hasSwitched,
  });
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
        <div className="battle-challenges" aria-label="Desafios da batalha">
          <span className={fastAvailable ? "" : "is-lost"}>
            ⏱ {String(Math.floor(elapsed / 60000)).padStart(2, "0")}:
            {String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")} ⚡ +15
          </span>
          <span className={onePokemonAvailable ? "" : "is-lost"}>🏆 +30</span>
        </div>
        <div className="arena-stage">
          <Fighter
            side="opponent"
            player={opponent}
            isHit={effect?.kind === "attack" && effect?.target === opponentRole}
            isAttacking={effect?.actor === opponentRole}
            isHealing={
              effect?.kind === "potion" &&
              effect?.target === opponentRole &&
              effect?.targetPokemonId === opponent.team[opponent.active].id
            }
          />
          <div className="arena-divider">
            <span>VS</span>
          </div>
          <Fighter
            side="player"
            player={me}
            isHit={effect?.kind === "attack" && effect?.target === role}
            isAttacking={effect?.actor === role}
            isHealing={
              effect?.kind === "potion" &&
              effect?.target === role &&
              effect?.targetPokemonId === me.team[me.active].id
            }
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
          {active.moves.map((move) => {
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
                  playBattleSound(move.special ? "golpe-normal" : "investida");
                  onAction({ type: "attack", moveId: move.id });
                }}
              >
                <span className="attack-icon">
                  <PokemonTypeIcon type={attackType} size={27} decorative />
                </span>
                <span>
                  <strong>{move.name}</strong>
                  <small>
                    {move.special
                      ? uses <= 0
                        ? "Esgotado"
                        : `${uses}/2 especial`
                      : `${move.power} poder${strong ? " · Forte" : weak ? " · Fraco" : ""}`}
                  </small>
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="potion-action"
          disabled={!myTurn || !Object.values(bag).some(Boolean)}
          onClick={() => {
            setSelectedItem(null);
            setIsBagOpen(true);
          }}
          aria-haspopup="dialog"
        >
          <Heart size={22} weight="fill" />
          <span>Itens</span>
          <strong>
            {Object.values(bag).reduce((total, amount) => total + amount, 0)}{" "}
            disponíveis
          </strong>
        </button>
        <div className="switch-row">
          <button
            type="button"
            className="switch-trigger"
            disabled={!myTurn}
            onClick={() => setIsSwitchOpen(true)}
            aria-haspopup="dialog"
          >
            Trocar
          </button>
          <div className="reserve-list">
            {me.team.map((pokemon, index) => (
              <button
                type="button"
                disabled={!myTurn || pokemon.hp <= 0 || index === me.active}
                onClick={() => onAction({ type: "switch", index })}
                aria-label={`Usar ${pokemon.name}`}
                key={`${pokemon.id}-${index}`}
                className={`${index === me.active ? "selected active" : ""} ${pokemon.hp <= 0 ? "fainted" : ""} ${getPokemonMatchup(pokemon, enemy)} ${getRarityClassName(pokemon)} ${effect?.kind === "potion" && effect?.target === role && effect?.targetPokemonId === pokemon.id ? "is-healing" : ""}`}
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
        {isBagOpen && (
          <motion.div
            className="potion-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
          >
            <motion.section
              className="potion-selector"
              role="dialog"
              aria-modal="true"
              aria-labelledby="potion-title"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
            >
              <div className="potion-selector-heading">
                <div>
                  <span className="eyebrow">
                    PO{"\u00c7"}
                    {"\u00c3"}O Ã—{potionsRemaining}
                  </span>
                  <h2 id="potion-title">
                    Usar po{"\u00e7"}
                    {"\u00e3"}o em
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPotionOpen(false)}
                  aria-label="Fechar seletor de poção"
                >
                  ×
                </button>
              </div>
              <div
                className="bag-item-picker"
                role="group"
                aria-label="Escolher item"
              >
                <button
                  type="button"
                  className={selectedBagItem === "potion" ? "selected" : ""}
                  disabled={!bag.potion}
                  onClick={() => setSelectedItem("potion")}
                >
                  Poção ×{bag.potion || 0}
                </button>
                <button
                  type="button"
                  className={selectedBagItem === "full-heal" ? "selected" : ""}
                  disabled={!bag["full-heal"]}
                  onClick={() => setSelectedItem("full-heal")}
                >
                  Cura Total ×{bag["full-heal"] || 0}
                </button>
              </div>
              <div className="potion-target-list">
                {me.team.map((pokemon, index) => {
                  const healing =
                    selectedBagItem === "potion"
                      ? getPotionHealAmount(pokemon)
                      : 0;
                  const unavailable =
                    pokemon.hp <= 0 ||
                    (selectedBagItem === "potion"
                      ? pokemon.hp >= pokemon.maxHp
                      : !pokemon.status);
                  return (
                    <button
                      type="button"
                      key={`${pokemon.id}-${index}`}
                      disabled={unavailable}
                      onClick={() => {
                        setIsPotionOpen(false);
                        onAction(
                          selectedBagItem === "potion"
                            ? { type: "potion", targetPokemonId: pokemon.id }
                            : {
                                type: "item",
                                itemId: selectedBagItem,
                                targetPokemonId: pokemon.id,
                              },
                        );
                      }}
                    >
                      <img src={getReserveSprite(pokemon)} alt="" />
                      <span>
                        <strong>{pokemon.name}</strong>
                        <small>
                          {pokemon.hp <= 0
                            ? "DESMAIADO"
                            : selectedBagItem === "potion" &&
                                pokemon.hp >= pokemon.maxHp
                              ? "HP CHEIO"
                              : selectedBagItem === "full-heal"
                                ? pokemon.status
                                  ? `CURAR ${pokemon.status.id.toUpperCase()}`
                                  : "SEM STATUS"
                                : `${pokemon.hp} / ${pokemon.maxHp}  +${healing} HP`}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSwitchOpen && (
          <motion.div
            className="potion-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="presentation"
          >
            <motion.section
              className="potion-selector"
              role="dialog"
              aria-modal="true"
              aria-labelledby="switch-title"
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.96 }}
            >
              <div className="potion-selector-heading">
                <div>
                  <span className="eyebrow">RESERVA</span>
                  <h2 id="switch-title">Trocar Pokémon</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSwitchOpen(false)}
                  aria-label="Fechar troca"
                >
                  ×
                </button>
              </div>
              <div className="potion-target-list">
                {me.team.map((pokemon, index) => (
                  <button
                    type="button"
                    key={pokemon.id + "-" + index}
                    disabled={index === me.active || pokemon.hp <= 0}
                    onClick={() => {
                      setIsSwitchOpen(false);
                      onAction({ type: "switch", index });
                    }}
                  >
                    <img src={getReserveSprite(pokemon)} alt="" />
                    <span>
                      <strong>{pokemon.name}</strong>
                      <small>
                        {index === me.active
                          ? "ATIVO"
                          : pokemon.hp +
                            " / " +
                            pokemon.maxHp +
                            (getPokemonMatchup(pokemon, enemy) === "advantage"
                              ? " · VANTAGEM"
                              : "")}
                      </small>
                    </span>
                  </button>
                ))}
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
              {state.winner === role ? (
                <Trophy size={42} weight="fill" />
              ) : (
                <WarningCircle size={42} weight="fill" />
              )}
              <span className="eyebrow">
                {state.winner === role ? "VOCÊ VENCEU" : "BOA BATALHA"}
              </span>
              <h2>{state.winner === role ? "Vitória!" : "Tente novamente"}</h2>
              <p>
                {state.winner === role
                  ? `${me.name} venceu esta batalha.`
                  : `${opponent.name} venceu desta vez.`}
              </p>
              {state.winner === role && (
                <div
                  className={`result-reward ${victoryReward.total === 60 ? "is-perfect" : ""}`}
                  aria-live="polite"
                >
                  <div className="reward-breakdown">
                    <span>
                      Vitória <b>+{victoryReward.base}</b>
                    </span>
                    {victoryReward.bonuses.fastVictory > 0 && (
                      <span>
                        ⚡ Vitória rápida{" "}
                        <b>+{victoryReward.bonuses.fastVictory}</b>
                      </span>
                    )}
                    {victoryReward.bonuses.onePokemonVictory > 0 && (
                      <span>
                        🏆 Um Pokémon só{" "}
                        <b>+{victoryReward.bonuses.onePokemonVictory}</b>
                      </span>
                    )}
                  </div>
                  <div className="reward-total">
                    <img src="/coin.png" alt="" aria-hidden="true" height="24" width="24" />
                    <div>
                      <strong>+{victoryReward.total} moedas</strong>
                      <span>Saldo: {coins}</span>
                    </div>
                  </div>
                </div>
              )}
              <button
                type="button"
                className="rematch-button"
                onClick={onRematch}
              >
                <ArrowsClockwise size={20} /> Pedir revanche
              </button>
              {state.winner === role && (
                <Link href="/loja" className="result-link">
                  Ir para a Loja Pokémon
                </Link>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
