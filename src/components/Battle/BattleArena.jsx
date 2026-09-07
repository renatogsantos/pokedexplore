"use client";

import {
  ArrowsClockwise,
  Backpack,
  Lightning,
  Sword,
  Trophy,
  WarningCircle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  getOpponentWeaknesses,
  getPokemonMatchup,
  getSupportedAbility,
  multiplier,
} from "@/lib/battle/engine";
import { getPokemonArtwork, getReserveSprite } from "@/lib/battle/pokemon";
import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";
import { playBattleSound } from "@/lib/battle/sound";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { calculateBattleRewards } from "@/lib/battle/rewards";
import PokemonTypeIcon from "@/components/PokemonTypeIcon";
import { getItemLabel, getStatusLabel, getTypeLabel } from "@/lib/localization/ptBR";
import { formatCoins } from "@/lib/economy";
import useBattleParallax from "@/hooks/useBattleParallax";

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
          className={`hp-fill ${percent < 35 ? "danger" : percent < 60 ? "warning" : ""}`}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.42 }}
        />
      </div>
    </div>
  );
}

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
          <span className="fighter-type-icons" aria-label={`Tipos: ${pokemon.types.map(getTypeLabel).join(", ")}`}>{pokemon.types.map((type) => <PokemonTypeIcon key={type} type={type} size={25} label={`Tipo ${getTypeLabel(type)}`} interactive />)}</span>
        </div>
        <HpBar pokemon={pokemon} />
        {ability && (
          <span className={`battle-ability ${pokemon.hp / pokemon.maxHp <= 1 / 3 ? "is-active" : ""}`} title={ability.description}>
            {ability.id}
          </span>
        )}
        {side === "player" && pokemon.heldItem && <span className="held-item-indicator">Item equipado: {getItemLabel(pokemon.heldItem)}</span>}
        {pokemon.status && (
          <span className={`battle-status is-${pokemon.status.id}`}>
            {getStatusLabel(pokemon.status.id)}
          </span>
        )}
        {side === "player" && matchup === "disadvantage" && (
          <small className="matchup-warning">⚠ Desvantagem</small>
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
          src={getPokemonSprite({
            pokemon,
            context: side === "player" ? SPRITE_CONTEXT.GENERAL : SPRITE_CONTEXT.BATTLE_ACTIVE,
            side: "opponent",
          })}
          alt={pokemon.name}
        />
        <span className="fighter-shadow" />
      </div>
    </div>
  );
}

function TeamStrip({ player, label }) {
  const remaining = player.team.filter((pokemon) => pokemon.hp > 0).length;
  return <div className="team-strip" aria-label={`${label}: ${remaining} Pokémon disponíveis`}><span>{label} · {remaining}/3</span><div>{player.team.map((pokemon, index) => <div key={`${pokemon.id}-${index}`} className={`team-slot ${index === player.active ? "active" : ""} ${pokemon.hp <= 0 ? "fainted" : ""} ${pokemon.status ? "has-status" : ""}`} aria-label={`${pokemon.name}: ${pokemon.hp <= 0 ? "desmaiado" : index === player.active ? "ativo" : "disponível"}${pokemon.status ? `, ${getStatusLabel(pokemon.status.id)}` : ""}`}><img src={getReserveSprite(pokemon)} alt="" /><small>{pokemon.hp <= 0 ? "KO" : pokemon.status ? getStatusLabel(pokemon.status.id).slice(0, 2) : ""}</small></div>)}</div></div>;
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
        detail: "POÇÃO! RECUPEROU VIDA!",
        tone: "healing",
      });
    else if (state.effect?.kind === "item")
      setNotification({ title: state.effect.itemId === "full-heal" ? "CURA TOTAL!" : "ITEM USADO!", detail: state.log, tone: "healing" });
    else if (state.effect?.berry)
      setNotification({ title: `${state.effect.berry.berry.toUpperCase()} BERRY!`, detail: state.effect.berry.healing ? `+${state.effect.berry.healing} HP` : "Status removido", tone: "healing" });
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

function AnimatedReward({ value }) {
  const [displayedValue, setDisplayedValue] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setDisplayedValue(value);
      return undefined;
    }

    let frame;
    const startedAt = performance.now();
    const duration = 420;
    const update = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      setDisplayedValue(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <strong aria-label={`Mais ${value} moedas`}>+{displayedValue}</strong>;
}

function RewardRow({ icon: Icon, label, value }) {
  return (
    <li>
      <span>
        <Icon size={17} weight="fill" aria-hidden="true" />
        {label}
      </span>
      <strong>+{value}</strong>
    </li>
  );
}

function BattleResultModal({ won, reward, coins, mode, onRematch }) {
  const rematchRef = useRef(null);
  const isPerfect = reward.total === 60;
  const rematchLabel = mode === "friend" ? "Pedir revanche" : "Jogar novamente";

  useEffect(() => {
    const focusFrame = requestAnimationFrame(() => rematchRef.current?.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, []);

  return (
    <motion.div
      className="result-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className={`result-card result-modal ${won ? "is-victory" : "is-defeat"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="battle-result-title"
        aria-describedby="battle-result-description"
        initial={{ opacity: 0, scale: 0.9, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <div className="result-modal__emblem" aria-hidden="true">
          {won ? <Trophy size={32} weight="fill" /> : <WarningCircle size={32} weight="fill" />}
        </div>
        <span className="result-modal__eyebrow">{won ? "VOCÊ VENCEU" : "DERROTA"}</span>
        <h2 id="battle-result-title">{won ? "Vitória!" : "Não foi dessa vez!"}</h2>
        <p id="battle-result-description">
          {won ? "Seu time venceu!" : "Ajuste sua estratégia e tente novamente."}
        </p>

        {won ? (
          <>
            {isPerfect && <span className="result-modal__perfect">Performance perfeita</span>}
            <section className="result-modal__reward" aria-live="polite" aria-label={`Você recebeu ${reward.total} moedas`}>
              <img src="/coin.png" alt="" aria-hidden="true" width="42" height="42" />
              <div>
                <AnimatedReward value={reward.total} />
                <span>MOEDAS</span>
              </div>
            </section>
            <section className="result-modal__breakdown" aria-label="Detalhes das recompensas">
              <span className="result-modal__section-label">RECOMPENSAS</span>
              <ul>
                <RewardRow icon={Sword} label="Vitória" value={reward.base} />
                {reward.bonuses.fastVictory > 0 && <RewardRow icon={Lightning} label="Vitória rápida" value={reward.bonuses.fastVictory} />}
                {reward.bonuses.onePokemonVictory > 0 && <RewardRow icon={Trophy} label="Um Pokémon só" value={reward.bonuses.onePokemonVictory} />}
              </ul>
              <div className="result-modal__balance">
                <span>Saldo atual</span>
                <strong><img src="/coin.png" alt="" aria-hidden="true" width="18" height="18" /> {formatCoins(coins)}</strong>
              </div>
            </section>
          </>
        ) : (
          <div className="result-modal__defeat-note">
            <img src="/coin.png" alt="" aria-hidden="true" width="24" height="24" />
            <span><strong>+0 moedas</strong> Você não perdeu moedas.</span>
          </div>
        )}

        <div className="result-modal__actions">
          <button type="button" className="rematch-button" onClick={onRematch} ref={rematchRef}>
            <ArrowsClockwise size={20} weight="bold" aria-hidden="true" /> {rematchLabel}
          </button>
          <Link href={won ? "/loja" : "/pokedex"} className="result-link">
            {won ? "Ir para a Loja Pokémon" : "Ver Pokédex"}
          </Link>
        </div>
      </motion.section>
    </motion.div>
  );
}

function BattleEnvironment() {
  return (
    <div className="battle-environment" aria-hidden="true">
      <div className="battle-environment__layer battle-environment__forest" data-parallax-layer="forest" />
      <div className="battle-environment__layer battle-environment__light" data-parallax-layer="light" />
      <div className="battle-environment__layer battle-environment__fog" data-parallax-layer="fog" />
      <div className="battle-environment__layer battle-environment__particles" data-parallax-layer="particles">
        <i /><i /><i /><i /><i />
      </div>
      <div className="battle-environment__layer battle-environment__foreground" data-parallax-layer="foreground" />
    </div>
  );
}

export default function BattleArena({ state, role, mode, onAction, onRematch }) {
  const [actionMode, setActionMode] = useState("moves");
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
  const itemCount = Object.values(bag).reduce(
    (total, amount) => total + amount,
    0,
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
  const arenaRef = useBattleParallax(state.status === "playing" || state.status === "countdown");
  return (
    <>
      <section
        ref={arenaRef}
        className={`battle-arena arena-${myTurn ? "ready" : "waiting"}`}
        aria-label="Arena de batalha"
      >
        <BattleEnvironment />
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
        <div className="battle-status-stack" aria-label="Estado das equipes">
          <TeamStrip player={opponent} label={opponent.name === "CPU" ? "CPU" : opponent.name} />
          <TeamStrip player={me} label="VOCÊ" />
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
        <div className="action-tabs" role="tablist" aria-label="Ações da batalha">
          <button type="button" role="tab" aria-selected={actionMode === "moves"} className={actionMode === "moves" ? "selected" : ""} onClick={() => { setActionMode("moves"); setSelectedItem(null); }}>
            <Sword size={16} weight="fill" aria-hidden="true" /> Sua ação
          </button>
          <button type="button" role="tab" aria-selected={actionMode === "items"} className={actionMode === "items" ? "selected" : ""} onClick={() => { setActionMode("items"); setSelectedItem(null); }}>
            <Backpack size={16} weight="fill" aria-hidden="true" /> Itens <span>{itemCount}</span>
          </button>
          <button type="button" role="tab" aria-selected={actionMode === "switch"} className={actionMode === "switch" ? "selected" : ""} onClick={() => { setActionMode("switch"); setSelectedItem(null); }}>
            <ArrowsClockwise size={16} weight="bold" aria-hidden="true" /> Trocar
          </button>
        </div>
        <div className="action-deck-panel">
          {actionMode === "moves" && (
            <div className="attack-grid v2-move-grid" role="tabpanel" aria-label="Golpes disponíveis">
              {Array.from({ length: 4 }, (_, index) => active.moves[index] || null).map((move, index) => {
                if (!move) return <div key={`empty-${index}`} className="move-slot-empty" aria-hidden="true"><span>＋</span><small>Indisponível</small></div>;
                const attackType = move.type === "own" ? active.type : move.type;
                const strong = multiplier(attackType, enemy) > 1;
                const weak = multiplier(attackType, enemy) < 1;
                const uses = active.specialAttackUsesRemaining ?? 0;
                const exhausted = move.special && uses <= 0;
                const effectiveness = strong ? "▲ FORTE" : weak ? "▼ FRACO" : "● NORMAL";
                return <button type="button" key={move.id} className={`attack-button ${strong ? "recommended" : ""} ${weak ? "disadvantage" : ""} ${move.special ? "is-special" : ""} ${exhausted ? "is-exhausted" : ""}`} disabled={!myTurn || exhausted} onClick={() => { playBattleSound(move.special ? "golpe-normal" : "investida"); onAction({ type: "attack", moveId: move.id }); }} aria-label={`${move.name}. ${move.special ? exhausted ? "Especial esgotado" : `Especial, ${uses} de 2 usos` : `${move.power} de poder, ${effectiveness}`} `}>
                  <span className="attack-icon"><PokemonTypeIcon type={attackType} size={25} decorative /></span>
                  <span className="attack-copy"><strong>{move.name}</strong><small className={move.special ? "special-meta" : "attack-meta"}>{move.special ? exhausted ? "ESGOTADO" : `ESPECIAL · ${uses}/2` : <><span>{move.power}</span><span>{effectiveness}</span></>}</small></span>
                </button>;
              })}
            </div>
          )}
          {actionMode === "items" && (
            <div className="deck-items" role="tabpanel" aria-label="Itens de batalha">
              {selectedItem ? <><div className="deck-panel-heading"><button type="button" onClick={() => setSelectedItem(null)}>Voltar</button><strong>Escolha o alvo</strong></div><div className="deck-target-list">{me.team.map((pokemon, index) => { const unavailable = pokemon.hp <= 0 || (selectedItem === "potion" ? pokemon.hp >= pokemon.maxHp : !pokemon.status); return <button type="button" key={`${pokemon.id}-${index}`} disabled={!myTurn || unavailable} onClick={() => { onAction(selectedItem === "potion" ? { type: "potion", targetPokemonId: pokemon.id } : { type: "item", itemId: selectedItem, targetPokemonId: pokemon.id }); setSelectedItem(null); setActionMode("moves"); }}><img src={getReserveSprite(pokemon)} alt=""/><span><strong>{pokemon.name}</strong><small>{pokemon.hp <= 0 ? "Desmaiado" : selectedItem === "potion" ? `${pokemon.hp}/${pokemon.maxHp} HP` : pokemon.status ? `Curar ${getStatusLabel(pokemon.status.id)}` : "Sem status"}</small></span></button>; })}</div></> : <div className="deck-item-grid"><button type="button" disabled={!myTurn || !bag.potion} onClick={() => setSelectedItem("potion")}><Backpack size={20} weight="fill" aria-hidden="true"/><span><strong>Poção</strong><small>Recupera 40% do HP</small></span><b>×{bag.potion || 0}</b></button><button type="button" disabled={!myTurn || !bag["full-heal"]} onClick={() => setSelectedItem("full-heal")}><Lightning size={20} weight="fill" aria-hidden="true"/><span><strong>Cura Total</strong><small>Remove condições</small></span><b>×{bag["full-heal"] || 0}</b></button></div>}
            </div>
          )}
          {actionMode === "switch" && (
            <div className="deck-switch-list" role="tabpanel" aria-label="Trocar Pokémon">{me.team.map((pokemon, index) => { const matchup = getPokemonMatchup(pokemon, enemy); const activeSlot = index === me.active; const fainted = pokemon.hp <= 0; return <button type="button" key={`${pokemon.id}-${index}`} className={`${activeSlot ? "active" : ""} ${fainted ? "fainted" : ""} ${matchup}`} disabled={!myTurn || activeSlot || fainted} onClick={() => { onAction({ type: "switch", index }); setActionMode("moves"); }} aria-label={`${pokemon.name}: ${activeSlot ? "ativo" : fainted ? "desmaiado" : "disponível para troca"}`}><img src={getReserveSprite(pokemon)} alt=""/><span><strong>{pokemon.name}</strong><small>{activeSlot ? "Ativo" : fainted ? "Desmaiado" : `${pokemon.hp}/${pokemon.maxHp} HP`}</small></span>{!activeSlot && !fainted && <em>{matchup === "advantage" ? "▲ Vantagem" : matchup === "disadvantage" ? "▼ Desvantagem" : "● Neutro"}</em>}</button>; })}</div>
          )}
        </div>
      </section>
      <AnimatePresence>
        {state.status === "finished" && (
          <BattleResultModal
            won={state.winner === role}
            reward={victoryReward}
            coins={coins}
            mode={mode}
            onRematch={onRematch}
          />
        )}
      </AnimatePresence>
    </>
  );
}
