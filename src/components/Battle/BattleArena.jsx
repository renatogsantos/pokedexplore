"use client";

import {
  ArrowsClockwise,
  Backpack,
  Crown,
  Lightning,
  Sparkle,
  Sword,
  Trophy,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  getOpponentWeaknesses,
  analyzeMoveDecision,
  getDamagePreview,
  getBagItemUsage,
  getBagItemUseBlockReason,
  MAX_HEALS_PER_POKEMON,
  MAX_SPECIAL_ATTACK_USES,
  MAX_BAG_ITEM_USES_PER_POKEMON,
  MOMENTUM_CONFIG,
  getPokemonMatchup,
  getSupportedAbility,
  multiplier,
} from "@/lib/battle/engine";
import { createItemFeedbackScheduler, getItemActivationEvents, EXIT_DURATION } from "@/lib/battle/itemFeedback";
import { SPRITE_CONTEXT } from "@/lib/pokemon/sprites";
import PokemonImage from "@/components/PokemonImage/PokemonImage";
import {
  createBattleAudioEventDeduper,
  getDamageReactionSound,
  getItemConsumptionSound,
  BATTLE_EVENT_SOUND,
  playBattleSound,
  preloadBattleSounds,
} from "@/lib/battle/sound";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { calculateBattleRewards } from "@/lib/battle/rewards";
import PokemonTypeIcon from "@/components/PokemonTypeIcon";
import {
  getItemLabel,
  getStatusLabel,
  getTypeLabel,
} from "@/lib/localization/ptBR";
import { formatCoins } from "@/lib/economy";
import useBattleParallax from "@/hooks/useBattleParallax";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import PokemonAura from "@/components/PokemonAura/PokemonAura";
import BadgeArtwork from "@/components/Badges/BadgeArtwork";
import { BADGE_REQUIRED_WINS } from "@/lib/badges/config";
import {
  BAG_ITEM_CATALOG,
  getItemDefinition,
  getItemUsagePresentation,
} from "@/lib/items/catalog";
import { getStatusDefinition } from "@/lib/battle/statuses";
import { getWagerResult } from "@/lib/battle/wager";
import StatusIcon from "@/components/Battle/StatusIcon";
import { getTournamentResultPresentation, TOURNAMENT_RESULT_STATE } from "@/lib/tournament/presentation";

function getBagBlockLabel(reason) {
  return {
    BAG_LIMIT_REACHED: "Limite da Mochila atingido",
    ITEM_LIMIT_REACHED: "Limite deste item atingido",
    HEAL_LIMIT_REACHED: "Limite de curas atingido",
    HP_FULL: "HP já está cheio",
    NO_STATUS: "Nenhum status para remover",
    BARRIER_ACTIVE: "Barreira já ativa",
    STIMULANT_ACTIVE: "Estimulante já ativo",
    SPECIAL_FULL: "Golpe Especial já está carregado",
    ACTIVE_POKEMON_REQUIRED: "Escolha o Pokémon ativo",
    ENEMY_ACTIVE_REQUIRED: "Escolha o Pokémon inimigo ativo",
    REFLECT_SHIELD_ACTIVE: "Escudo refletor já ativo",
    OVERLOAD_ACTIVE: "Sobrecarga já ativa",
    TARGET_FAINTED: "Desmaiado",
  }[reason] || "Indisponível nesta batalha";
}

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

// Presentation-only: values are read from the current fighter in the
// authoritative state, so switching, CPU turns and synchronized PvP state all
// update this HUD without a second client-side resource store.
function BattleResourceBar({ icon: Icon, label, current, max, variant, description }) {
  const safeMax = Math.max(1, Number(max) || 1);
  const safeCurrent = Math.min(safeMax, Math.max(0, Number(current) || 0));
  const percent = (safeCurrent / safeMax) * 100;
  return <div className={`battle-resource-bar is-${variant} ${safeCurrent === 0 ? "is-depleted" : ""}`} aria-label={`${description}: ${safeCurrent} de ${safeMax}`}>
    <span className="battle-resource-bar__label"><Icon size={12} weight="fill" aria-hidden="true" /> {label}</span>
    <strong>{safeCurrent}/{safeMax}</strong>
    <span className="battle-resource-bar__track" aria-hidden="true">
      <motion.i key={safeCurrent} className="battle-resource-bar__fill" animate={{ width: `${percent}%` }} transition={{ duration: 0.24 }} />
    </span>
  </div>;
}

function BattleResourceBars({ pokemon }) {
  const healingRemaining = Math.max(0, MAX_HEALS_PER_POKEMON - (Number(pokemon.healsUsed) || 0));
  return <section className="battle-resource-list" aria-label={`Recursos estratégicos de ${pokemon.name}`}>
    <BattleResourceBar icon={Lightning} label="IMPULSO" current={pokemon.momentum} max={MOMENTUM_CONFIG.MAX} variant="momentum" description="Impulso acumulado" />
    <BattleResourceBar icon={Sparkle} label="ESPECIAL" current={pokemon.specialAttackUsesRemaining} max={MAX_SPECIAL_ATTACK_USES} variant="special" description="Especiais restantes" />
    <BattleResourceBar icon={Backpack} label="CURAS" current={healingRemaining} max={MAX_HEALS_PER_POKEMON} variant="healing" description="Curas restantes" />
  </section>;
}

const TEMPORARY_ITEM_LABELS = Object.freeze({
  barrier: "BARREIRA ATIVA",
  ruin: "RUÍNA ARMADA",
  timeBomb: "BOMBA TEMPORAL",
  reflectShield: "ESCUDO REFLETOR",
  stimulant: "PRÓXIMO ATAQUE +35%",
  phoenix: "RENASCIMENTO +25%",
  fury: "FÚRIA ATIVA",
  hunterMark: "MARCA DO CAÇADOR",
  silence: "ESPECIAL BLOQUEADO",
  anchor: "TROCA BLOQUEADA",
  overload: "SOBRECARGA",
  regeneration: "REGENERAÇÃO",
});

const TEMPORARY_ITEM_IDS = Object.freeze({
  barrier: "instant-barrier",
  ruin: "fragmento-da-ruina",
  timeBomb: "bomba-temporal",
  reflectShield: "escudo-refletor",
  stimulant: "stimulant",
  phoenix: "phoenix-heart",
  fury: "cristal-da-furia",
  hunterMark: "marca-do-cacador",
  silence: "selo-do-silencio",
  anchor: "ancora-dimensional",
  overload: "nucleo-de-sobrecarga",
  regeneration: "regeneration-leaf",
});

function BattleItemEffectIndicators({ pokemon }) {
  const effects = Object.entries(pokemon.temporaryEffects || {}).filter(([key, value]) => value && TEMPORARY_ITEM_LABELS[key]);
  if (!effects.length) return null;
  return <div className="battle-item-effects" aria-label={`Efeitos de item em ${pokemon.name}`}>{effects.map(([key, value]) => <span key={key} className={`battle-item-effect is-${key}`}>{TEMPORARY_ITEM_LABELS[key]}{value?.ticks ? ` · ${value.ticks}T` : ""}</span>)}</div>;
}

function ItemEffectOverlay({ pokemon, effect, sideEffects, enabled, revision, targetKey }) {
  const [feedback, setFeedback] = useState(null);
  const scheduler = useRef(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    scheduler.current = createItemFeedbackScheduler(setFeedback);
    return () => { scheduler.current.dispose(); scheduler.current = null; };
  }, []);
  useEffect(() => {
    scheduler.current.clear();
  }, [targetKey, enabled]);
  useEffect(() => {
    if (enabled && pokemon.hp > 0) scheduler.current.enqueue(getItemActivationEvents(effect, pokemon), revision);
    else scheduler.current.clear();
  }, [effect, revision, targetKey, enabled, pokemon.hp]);
  const activeEffects = Object.entries(pokemon.temporaryEffects || {}).filter(([key, value]) => value && TEMPORARY_ITEM_IDS[key]);
  if (sideEffects?.elementalMine) activeEffects.push(["elementalMine", sideEffects.elementalMine]);
  const activations = feedback && enabled && pokemon.hp > 0 ? getItemActivationEvents({ itemEvents: [feedback.event] }, pokemon) : [];
  if (!activeEffects.length && !activations.length) return null;
  return <div className="item-effect-overlay" aria-label={`Efeitos de itens sobre ${pokemon.name}`}>
    <>
      {activations.map((event) => {
        const definition = getItemDefinition(event.itemId);
        if (!definition) return null;
        const amount = event.effect?.amount;
        const result = amount ? `${event.effect?.type === "heal_hp" ? "+" : "−"}${amount} HP` : event.effect?.type === "delayed_damage" ? "ATIVADA" : "EM EFEITO";
        const metadata = [Number.isFinite(event.remaining) ? `×${event.remaining} restantes` : null, Number.isFinite(event.itemUsageCount) ? `usos ${event.itemUsageCount}/${event.itemUsageLimit}` : null].filter(Boolean).join(" · ");
        const tone = event.effect?.type === "heal_hp" ? "heal" : event.effect?.type === "delayed_damage" ? "damage" : definition.effectType?.includes("BARRIER") || definition.effectType?.includes("SHIELD") ? "defense" : "power";
        return <span key={feedback.key} className="item-effect-activation-anchor"><motion.div className={`item-effect-activation is-${tone}`} initial={{ opacity: 0, scale: reducedMotion ? 1 : .90, y: 0 }} animate={feedback.phase === "exiting" ? { opacity: 0, scale: reducedMotion ? 1 : .96, y: 0 } : { opacity: 1, scale: 1, y: 0 }} transition={{ type: "tween", duration: EXIT_DURATION / 1000 }}>
          <ItemSprite item={event.itemId} alt="" className="item-effect-activation__sprite" />
          <small className="item-effect-activation__name">{definition.name}</small>
          <strong className="item-effect-activation__result">{result}</strong>
          {metadata ? <small className="item-effect-activation__meta">{metadata}</small> : null}
        </motion.div></span>;
      })}
    </>
    <div className="item-effect-cluster">
      {activeEffects.map(([key, value]) => {
        const itemId = key === "elementalMine" ? "mina-elemental" : TEMPORARY_ITEM_IDS[key];
        const label = key === "elementalMine" ? "MINA ARMADA" : TEMPORARY_ITEM_LABELS[key];
        const turns = value?.ticks;
        return <span key={key} className={`item-effect-token is-${key}`} title={`${label}${turns ? ` · ${turns} turnos restantes` : ""}`}>
          <ItemSprite item={itemId} alt="" className="item-effect-token__sprite" />
          {turns ? <b>{turns}</b> : null}
          <span className="sr-only">{label}{turns ? `, ${turns} turnos restantes` : ""}</span>
        </span>;
      })}
    </div>
  </div>;
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

function StatusBadge({ pokemon, onOpen }) {
  const definition = getStatusDefinition(pokemon.status);
  if (!definition) return null;
  return (
    <button
      type="button"
      className={`battle-status is-${definition.id}`}
      onClick={() => onOpen?.({ pokemon, status: pokemon.status })}
      aria-label={`${pokemon.name} está ${definition.displayName.toLowerCase()}. Toque para entender a condição.`}
    >
      <StatusIcon status={definition.id} size={13} />
      <span>{definition.displayName}</span>
    </button>
  );
}

function Fighter({
  side,
  matchId,
  battleStatus,
  revision,
  player,
  isHit,
  isAttacking,
  isHealing,
  effect,
  matchup,
  statusEvent,
  onStatusOpen,
}) {
  const pokemon = player.team[player.active];
  const ability = getSupportedAbility(pokemon.ability);
  const heldItemPresentation = getItemUsagePresentation(pokemon.heldItem);
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
          <span
            className="fighter-type-icons"
            aria-label={`Tipos: ${pokemon.types.map(getTypeLabel).join(", ")}`}
          >
            {pokemon.types.map((type) => (
              <PokemonTypeIcon
                key={type}
                type={type}
                size={25}
                label={`Tipo ${getTypeLabel(type)}`}
                interactive
              />
            ))}
          </span>
        </div>
        <HpBar pokemon={pokemon} />
        <BattleResourceBars pokemon={pokemon} />
        {pokemon.status && (
          <StatusBadge pokemon={pokemon} onOpen={onStatusOpen} />
        )}
        {ability && (
          <span
            className={`battle-ability ${pokemon.hp / pokemon.maxHp <= 1 / 3 ? "is-active" : ""}`}
            title={ability.description}
          >
            <Lightning size={13} weight="fill" aria-hidden="true" />{" "}
            {ability.namePtBr}
          </span>
        )}
        {pokemon.heldItem && (
          <span
            className="held-item-indicator"
            title={`${getItemLabel(pokemon.heldItem)} · ${heldItemPresentation?.persistenceLabel || "ITEM"}. ${heldItemPresentation?.triggerLabel || ""}`}
          >
            <ItemSprite
              item={pokemon.heldItem}
              alt=""
              className="battle-held-indicator-sprite"
            />
            <span className="held-item-copy">
              <span>{getItemLabel(pokemon.heldItem)}</span>
              <b>{heldItemPresentation?.persistenceLabel || "PRONTO"}</b>
            </span>
          </span>
        )}
        {pokemon.elementalRelic && (
          <span className="held-item-indicator" title={`Relíquia · ${getItemLabel(pokemon.elementalRelic)}`}>
            <ItemSprite item={pokemon.elementalRelic} alt="" className="battle-held-indicator-sprite" />
            <span className="held-item-copy"><span>{getItemLabel(pokemon.elementalRelic)}</span><b>RELÍQUIA</b></span>
          </span>
        )}
        <BattleItemEffectIndicators pokemon={pokemon} />
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
        <span className="fighter-shadow" aria-hidden="true" />
        {statusEvent && (
          <span
            className={`status-vfx is-${statusEvent.status} is-${statusEvent.type.toLowerCase()}`}
            aria-hidden="true"
          >
            <StatusIcon status={statusEvent.status} size={28} />
            <i />
            <i />
            <i />
          </span>
        )}
        <PokemonAura
          pokemon={pokemon}
          variant="battle"
          className="fighter-aura"
        >
          <PokemonImage
            ImageComponent={motion.img}
            animate={{ y: [0, -5, 0] }}
            transition={{
              repeat: Infinity,
              duration: side === "player" ? 2.4 : 2.8,
            }}
            pokemon={pokemon}
            context={SPRITE_CONTEXT.BATTLE_ACTIVE}
            side={side}
            alt={pokemon.name}
          />
        </PokemonAura>
        <ItemEffectOverlay key={`${matchId}:${side}`} pokemon={pokemon} effect={effect} sideEffects={player.temporarySideEffects} enabled={battleStatus === "playing"} revision={revision} targetKey={`${player.active}:${pokemon.id}`} />
      </div>
    </div>
  );
}

function TeamStrip({ player, label, side }) {
  const remaining = player.team.filter((pokemon) => pokemon.hp > 0).length;
  return (
    <div
      className={`team-strip team-strip--${side}`}
      aria-label={`${label}: ${remaining} Pokémon disponíveis`}
    >
      <div>
        {player.team.map((pokemon, index) => (
          <div
            key={`${pokemon.id}-${index}`}
            className={`team-slot ${index === player.active ? "active" : ""} ${pokemon.hp <= 0 ? "fainted" : ""} ${pokemon.status ? "has-status" : ""}`}
            aria-label={`${pokemon.name}: ${pokemon.hp <= 0 ? "desmaiado" : index === player.active ? "ativo" : "disponível"}${pokemon.status ? `, ${getStatusLabel(pokemon.status.id)}` : ""}`}
          >
            <PokemonImage
              pokemon={pokemon}
              context={SPRITE_CONTEXT.BATTLE_THUMBNAIL}
              alt=""
            />
            <small>
              {pokemon.hp <= 0 ? (
                "KO"
              ) : pokemon.status ? (
                <StatusIcon status={pokemon.status.id} size={9} />
              ) : (
                ""
              )}
            </small>
          </div>
        ))}
      </div>
    </div>
  );
}

function getCureTitle(status) {
  if (status === "paralysis") return "PARALISIA REMOVIDA!";
  if (status === "burn") return "QUEIMADURA REMOVIDA!";
  if (status === "poison") return "VENENO REMOVIDO!";
  return "SONO REMOVIDO!";
}

function statusNotification(event) {
  if (
    !event ||
    event.type === "STATUS_ATTEMPTED" ||
    (!event.successful && event.type !== "STATUS_PREVENTED")
  )
    return null;
  const definition = getStatusDefinition(event.status);
  if (!definition) return null;
  if (event.type === "STATUS_APPLIED")
    return {
      title: `${definition.eventName.toUpperCase()}!`,
      detail: event.moveName
        ? `${event.moveName} também deixou ${event.targetPokemonName} ${definition.displayName.toLowerCase()}.`
        : event.sourceKind === "ability"
          ? `Uma habilidade deixou ${event.targetPokemonName} ${definition.displayName.toLowerCase()}.`
          : `${event.targetPokemonName} recebeu a condição.`,
      tone: `status is-${definition.id}`,
      status: definition.id,
      duration: 1200,
    };
  if (event.type === "STATUS_TRIGGERED")
    return {
      title: definition.eventName.toUpperCase(),
      detail:
        event.status === "sleep"
          ? `${event.targetPokemonName} continua dormindo e não pode atacar neste turno.`
          : `${event.targetPokemonName} não conseguiu se mover!`,
      tone: `status is-${definition.id}`,
      status: definition.id,
      duration: 1250,
    };
  if (event.type === "STATUS_DAMAGE")
    return {
      title: definition.eventName.toUpperCase(),
      detail: `-${event.damage} HP em ${event.targetPokemonName}.`,
      tone: `status is-${definition.id}`,
      status: definition.id,
      duration: 950,
    };
  if (event.type === "STATUS_CURED")
    return {
      title: getCureTitle(event.status),
      detail: `${getItemLabel(event.itemId) || "O item"} curou ${event.targetPokemonName}.`,
      tone: "healing",
      itemId: event.itemId,
      duration: 1100,
    };
  if (event.type === "STATUS_EXPIRED")
    return {
      title: "ACORDOU!",
      detail: `${event.targetPokemonName} pode agir novamente.`,
      tone: "healing",
      duration: 1050,
    };
  if (event.type === "STATUS_PREVENTED")
    return {
      title: "STATUS EVITADO!",
      detail: `${getItemLabel(event.itemId)} protegeu ${event.targetPokemonName}.`,
      tone: "healing",
      itemId: event.itemId,
      duration: 1050,
    };
  return null;
}

function itemEventNotification(event) {
  const definition = getItemDefinition(event?.itemId);
  if (!definition) return null;
  const presentation = getItemUsagePresentation(definition);
  const effect = event.effect || {};
  const percent = effect.multiplier
    ? Math.round(Math.abs(effect.multiplier - 1) * 100)
    : null;
  let detail = presentation.effectLabel;
  if (effect.type === "heal_hp" && effect.amount)
    detail = `Recuperou ${effect.amount} HP.`;
  if (effect.type === "regeneration")
    detail = `Regeneração por ${effect.ticks} turnos.`;
  if (effect.type === "survive")
    detail = `Evitou o nocaute e ficou com ${effect.hp} HP${effect.nextAttackMultiplier ? ` · próximo ataque +${Math.round((effect.nextAttackMultiplier - 1) * 100)}%` : ""}.`;
  if (effect.type === "prevent_status")
    detail = `${getStatusLabel(effect.status)} bloqueado${effect.healing ? ` · +${effect.healing} HP` : ""}.`;
  if (effect.type === "cure_status")
    detail = `${getStatusLabel(effect.status)} removido${effect.healing ? ` · +${effect.healing} HP` : ""}.`;
  if (effect.type === "damage_multiplier" && percent != null)
    detail =
      effect.multiplier < 1
        ? `Reduziu ${percent}% do dano.`
        : `Ataque fortalecido em ${percent}%.`;
  if (["delayed_damage", "damage", "reflect_damage"].includes(effect.type) && effect.amount)
    detail = `-${effect.amount} HP.`;
  if (effect.type === "restore_special") detail = `+${effect.amount} uso Especial.`;
  if (effect.type === "fury_armed") detail = `Fúria ativa por ${effect.rounds} turnos.`;
  if (effect.type === "momentum") detail = `+${effect.amount} Impulso.`;
  return {
    title: `${definition.name.toUpperCase()} ${event.consumed ? "ATIVADO!" : "EM EFEITO"}`,
    detail: `${detail} ${event.consumed ? "Item consumido." : "Permanece equipado."}`,
    tone:
      definition.rarity === "LEGENDARY"
        ? "strong"
        : event.consumed
          ? "healing"
          : "turn",
    itemId: definition.id,
    audio: getItemConsumptionSound({ definition, event }),
    audioEventId: event.eventId,
    duration:
      definition.rarity === "LEGENDARY" ? 1150 : event.consumed ? 950 : 650,
  };
}

function abilityEventNotification(event) {
  if (!event?.abilityName) return null;
  const effect = event.effect || {};
  let detail = "Habilidade ativada.";
  if (effect.type === "status")
    detail = `O ataque fez contato e ${event.targetPokemonName} ficou ${getStatusLabel(effect.status).toLowerCase()}.`;
  if (effect.type === "reflect_status")
    detail = `${getStatusLabel(effect.status)} foi refletido em ${event.targetPokemonName}.`;
  if (effect.type === "absorb_and_heal")
    detail = `O golpe ${getTypeLabel(effect.attackType)} foi absorvido${effect.healing ? ` · +${effect.healing} HP` : ""}.`;
  if (effect.type === "absorb_and_empower")
    detail = "O golpe de Fogo foi absorvido. Golpes Fire foram fortalecidos.";
  if (effect.type === "immune")
    detail = `O golpe ${getTypeLabel(effect.attackType)} não causou dano.`;
  if (effect.type === "damage_multiplier")
    detail = `Dano fortalecido em ${Math.round((effect.multiplier - 1) * 100)}%.`;
  if (effect.type === "survive")
    detail = "Resistiu ao golpe com 1 HP!";
  if (effect.type === "contact_recoil")
    detail = `O contato feriu ${event.targetPokemonName}! -${effect.damage} HP.`;
  if (effect.type === "prevent_status")
    detail = `${event.targetPokemonName} nÃ£o pode receber ${getStatusLabel(effect.status).toLowerCase()}.`;
  if (effect.type === "heal_hp")
    detail = `${event.targetPokemonName} recuperou +${effect.amount} HP.`;
  if (effect.type === "stat_stage")
    detail =
      effect.stages > 0
        ? `${({ speed: "Velocidade", specialAttack: "Ataque Especial", attack: "Ataque" })[effect.stat] || "Atributo"} aumentou.`
        : "Ataque do adversário diminuiu.";
  return {
    title: `${event.abilityName.toUpperCase()}!`,
    detail,
    tone: "strong",
    duration: 1050,
  };
}

function buildBattleNotifications(state, role, opponentName) {
  if (state.status === "countdown")
    return [
      { title: "3 · 2 · 1", detail: "BATALHA!", tone: "turn", duration: 1450 },
    ];
  if (state.status === "finished")
    return [
      {
        title: "BATALHA ENCERRADA",
        detail: state.log,
        tone: "result",
        duration: 1400,
      },
    ];
  const effect = state.effect;
  if (!effect)
    return [
      state.turn === role
        ? {
            title: "SUA VEZ!",
            detail: "Escolha um ataque",
            tone: "turn",
            duration: 1050,
          }
        : {
            title: `VEZ DE ${opponentName.toUpperCase()}`,
            detail: "Aguardando adversário...",
            tone: "waiting",
            duration: 1050,
          },
    ];
  const queue = [];
  if (["attack", "miss"].includes(effect.kind) && effect.moveName)
    queue.push({
      title: `${effect.sourcePokemonName?.toUpperCase() || "POKÉMON"} USOU ${effect.moveName.toUpperCase()}!`,
      detail:
        effect.kind === "miss" ? "O golpe não acertou." : "Golpe em execução",
      tone: "move",
      duration: 800,
    });
  if (effect.kind === "attack" && effect.damage > 0)
    queue.push({
      title: `-${effect.damage} HP`,
      detail: effect.effective
        ? "SUPER EFETIVO!"
        : `${effect.targetPokemonName} recebeu o golpe.`,
      tone: effect.effective ? "strong" : "damage",
      duration: 850,
    });
  for (const event of effect.momentumEvents || [])
    queue.push({
      title: event.type === "MOMENTUM_GAINED" ? "IMPULSO +1" : "IMPULSO USADO",
      detail: event.type === "MOMENTUM_GAINED" ? `${event.after}/3` : `${event.before}/3 Â· +${Math.round((event.multiplier - 1) * 100)}% poder`,
      tone: "turn",
      duration: 700,
    });
  for (const event of effect.abilityEvents || []) {
    const notification = abilityEventNotification(event);
    if (notification) queue.push(notification);
  }
  for (const event of effect.statusEvents || []) {
    const notification = statusNotification(event);
    if (notification) queue.push(notification);
  }
  // Item feedback is rendered in ItemEffectOverlay, inside the affected
  // fighter artwork. Keeping it out of this global queue prevents a second,
  // arena-centered receipt from competing with the actual target feedback.
  if (effect.kind === "switch")
    queue.push({
      title: "TROCA!",
      detail: state.log,
      tone: "turn",
      duration: 1050,
    });
  return queue.length
    ? queue
    : [
        {
          title:
            state.turn === role
              ? "SUA VEZ!"
              : `VEZ DE ${opponentName.toUpperCase()}`,
          detail: state.log,
          tone: "turn",
          duration: 1050,
        },
      ];
}

function BattleNotification({ state, role, opponentName }) {
  const [notification, setNotification] = useState(null);
  const audioDeduper = useRef(null);
  const initialAudioHydration = useRef(true);
  if (!audioDeduper.current) audioDeduper.current = createBattleAudioEventDeduper();

  useEffect(() => {
    preloadBattleSounds();
  }, []);

  useEffect(() => {
    const isHydrating = initialAudioHydration.current;
    initialAudioHydration.current = false;
    if (!isHydrating && state.effect?.kind === "attack" && Number(state.effect.damage) > 0 &&
        audioDeduper.current.shouldPlay(state.matchId, state.effect.eventId, "damage-reaction")) {
      const targetTeam = state[state.effect.target]?.team || [];
      const targetPokemon = targetTeam.find(
        (pokemon) =>
          String(pokemon.id) === String(state.effect.targetPokemonId),
      );
      playBattleSound(getDamageReactionSound(targetPokemon), 0.5);
    }
    const queue = buildBattleNotifications(state, role, opponentName);
    const timers = [];
    let elapsed = 0;
    if (!isHydrating)
      (state.audioEvents || []).forEach((event) => {
        if (event?.audience && event.audience !== role) return;
        const playAuthoritativeEvent = () => {
          if (audioDeduper.current.shouldPlay(state.matchId, event?.id, event?.sound))
            playBattleSound(event.sound, event.sound === BATTLE_EVENT_SOUND.FINISH_HIM ? 1 : 0.80);
        };
        if (Number(event?.delayMs) > 0) timers.push(window.setTimeout(playAuthoritativeEvent, event.delayMs));
        else playAuthoritativeEvent();
      });
    if (!isHydrating) {
      if (state.effect?.kind === "item") {
        const definition = getItemDefinition(state.effect.itemId);
        const sound = getItemConsumptionSound({ definition, effect: state.effect });
        if (sound && audioDeduper.current.shouldPlay(state.matchId, state.effect.eventId, sound))
          playBattleSound(sound, 0.5);
      }
      (state.effect?.itemEvents || []).forEach((event) => {
        const definition = getItemDefinition(event.itemId);
        const sound = getItemConsumptionSound({ definition, event });
        if (sound && audioDeduper.current.shouldPlay(state.matchId, event.eventId, sound))
          playBattleSound(sound, 0.5);
      });
    }
    queue.forEach((entry, index) => {
      timers.push(
        window.setTimeout(() => {
          setNotification({ ...entry, index });
          if (
            !isHydrating &&
            entry.audio &&
            audioDeduper.current.shouldPlay(state.matchId, entry.audioEventId, entry.audio)
          )
            playBattleSound(entry.audio, 0.5);
        }, elapsed),
      );
      elapsed += entry.duration || 1050;
    });
    timers.push(window.setTimeout(() => setNotification(null), elapsed));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [state.revision, state.status, role, opponentName]);
  return (
    <AnimatePresence mode="wait">
      {notification && (
        <div className="battle-notification-anchor">
          <motion.div
            key={`${state.revision}-${notification.index}-${notification.title}-${state.status}`}
            className={`battle-notification ${notification.tone}`}
            initial={{ opacity: 0, scale: 0.72, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.08, y: -10 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
          >
            {notification.itemId && (
              <ItemSprite
                item={notification.itemId}
                alt=""
                className="battle-notification-item"
              />
            )}
            {notification.status && (
              <StatusIcon status={notification.status} size={24} />
            )}
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
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
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

function BadgeBattleResultModal({ won, badgeContext, onRematch }) {
  const actionRef = useRef(null);
  const { config, challenge, resolution, resolving, playerId, error } =
    badgeContext;
  const status = resolution?.status || challenge?.status;
  const isChallenger = challenge?.challenger_player_id === playerId;
  const acquired = status === "COMPLETED";
  const defended = status === "FAILED";
  const active =
    status === "ACTIVE" &&
    resolution &&
    Number(resolution.current_battle) > Number(challenge?.current_battle || 0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => actionRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [resolving]);
  const title = resolving
    ? "Confirmando resultado..."
    : error
      ? "Resultado pendente"
      : acquired
        ? "Novo campeão!"
        : defended
          ? challenge?.challenge_kind === "PVP_TAKEOVER"
            ? "Insígnia defendida"
            : "Desafio encerrado"
          : active
            ? won
              ? "Vitória confirmada"
              : "O desafiante avançou"
            : "Batalha concluída";
  const description = acquired
    ? `${challenge?.challenger_name} conquistou a ${config.name} com ${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas.`
    : defended
      ? challenge?.challenge_kind === "PVP_TAKEOVER"
        ? `${challenge?.defender_name} continua como campeão.`
        : `Você chegou a ${resolution?.challenger_wins || 0} de ${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas.`
      : active
        ? `${resolution?.challenger_wins || 0}/${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas. A equipe pode mudar antes da próxima batalha.`
        : "Aguarde a confirmação compartilhada antes de continuar.";
  const canContinue = !resolving && !error && (active || acquired || defended);
  return (
    <motion.div
      className="result-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.section
        className={`result-card result-modal badge-result-modal ${acquired ? "is-victory is-champion" : defended && isChallenger ? "is-defeat" : "is-victory"}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="badge-battle-result-title"
        initial={{ opacity: 0, scale: 0.9, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
      >
        <BadgeArtwork badge={config} />
        <span className="result-modal__eyebrow">DESAFIO DA INSÍGNIA</span>
        <h2 id="badge-battle-result-title">{title}</h2>
        <p>{description}</p>
        {!resolving && !error && (
          <div
            className="badge-series-result"
            aria-label={`${resolution?.challenger_wins || 0} de ${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas`}
          >
            <div>
              {Array.from(
                { length: challenge?.wins_required || BADGE_REQUIRED_WINS },
                (_, index) => (
                  <i
                    key={index}
                    className={
                      index < (resolution?.challenger_wins || 0) ? "won" : ""
                    }
                  />
                ),
              )}
            </div>
            <strong>
              {resolution?.challenger_wins || 0} /{" "}
              {challenge?.wins_required || BADGE_REQUIRED_WINS}
            </strong>
            <span>
              {active &&
              Number(resolution?.challenger_wins) === Number(challenge?.wins_required || BADGE_REQUIRED_WINS) - 1
                ? "MATCH POINT"
                : acquired
                  ? "SÉRIE PERFEITA"
                  : defended
                    ? "SÉRIE ENCERRADA"
                    : "VITÓRIAS CONSECUTIVAS"}
            </span>
          </div>
        )}
        {error && <p className="badge-result-error">{error}</p>}
        <div className="result-modal__actions">
          <button
            ref={actionRef}
            type="button"
            className="rematch-button"
            onClick={onRematch}
            disabled={!canContinue}
          >
            {resolving
              ? "Confirmando..."
              : active
                ? "Preparar próxima batalha"
                : "Voltar às Insígnias"}
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function StatusDetails({ selection, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!selection) return null;
  const definition = getStatusDefinition(selection.status);
  if (!definition) return null;
  const source =
    selection.status.sourceMoveName ||
    (selection.status.sourceItemId
      ? getItemLabel(selection.status.sourceItemId)
      : null) ||
    (selection.status.sourceAbilityId
      ? `Habilidade ${selection.status.sourceAbilityId}`
      : null) ||
    selection.status.sourcePokemonName;
  return (
    <motion.div
      className="status-detail-overlay"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.section
        className={`status-detail-sheet is-${definition.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-detail-title"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 12, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.96 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          className="status-detail-close"
          onClick={onClose}
          aria-label="Fechar explicação do status"
        >
          <X size={18} weight="bold" aria-hidden="true" />
        </button>
        <div className="status-detail-heading">
          <StatusIcon status={definition.id} size={24} />
          <div>
            <small>CONDIÇÃO ATUAL</small>
            <strong id="status-detail-title">{definition.displayName}</strong>
          </div>
        </div>
        <p>{definition.battleDescription}</p>
        {source && (
          <div className="status-detail-source">
            <span>CAUSADO POR</span>
            <strong>{source}</strong>
          </div>
        )}
        <div className="status-detail-response">
          <span>COMO RESPONDER</span>
          <p>{definition.strategicHint}</p>
        </div>
      </motion.section>
    </motion.div>
  );
}

function TournamentBattleResultModal({ won, context, onContinue, actionRef }) {
  const presentation = getTournamentResultPresentation({ round: context.round, won, mode: context.mode, receipt: context.receipt });
  const receipt = presentation.receipt;
  const item = receipt?.itemId ? getItemDefinition(receipt.itemId) : null;
  const advancing = presentation.state === TOURNAMENT_RESULT_STATE.SEMIFINAL_ADVANCE;
  const title = advancing ? "CLASSIFICADO PARA A FINAL" : presentation.state === TOURNAMENT_RESULT_STATE.FINAL_CHAMPION ? "CAMPEÃO!" : presentation.state === TOURNAMENT_RESULT_STATE.FINALIST ? "VICE-CAMPEÃO" : "DERROTA";
  const description = advancing ? "Você venceu esta batalha. O campeonato continua." : presentation.state === TOURNAMENT_RESULT_STATE.FINAL_CHAMPION ? "Você venceu o campeonato!" : presentation.state === TOURNAMENT_RESULT_STATE.FINALIST ? "Você chegou até a final!" : "Sua jornada neste campeonato terminou.";
  return <motion.div className="result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className={`result-card result-modal ${won ? "is-victory" : "is-defeat"}`} role="dialog" aria-modal="true" aria-labelledby="tournament-result-title" initial={{ opacity: 0, scale: 0.9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}><div className="result-modal__emblem" aria-hidden="true">{presentation.state === TOURNAMENT_RESULT_STATE.FINAL_CHAMPION ? <Crown size={32} weight="fill" /> : won ? <Trophy size={32} weight="fill" /> : <WarningCircle size={32} weight="fill" />}</div><span className="result-modal__eyebrow">CAMPEONATO{presentation.hybrid ? " HÍBRIDO · PRÊMIOS ×0,5" : ""}</span><h2 id="tournament-result-title">{title}</h2><p>{description}</p>{!advancing && (receipt ? <section className="result-modal__breakdown" aria-label="Recompensa do campeonato"><span className="result-modal__section-label">SUAS RECOMPENSAS</span><section className="result-modal__reward"><img src="/coin.png" alt="" aria-hidden="true" width="42" height="42" /><div><AnimatedReward value={receipt.coins} /><span>MOEDAS</span></div></section>{item && <div className={`cpu-result-drop rarity-${String(item.rarity).toLowerCase()}`}><span><ItemSprite item={item.id} alt="" /> {item.name}</span><strong>{item.rarity}</strong></div>}</section> : <p className="result-modal__defeat-note">Confirmando a recompensa do campeonato...</p>)}<div className="result-modal__actions"><button type="button" className="rematch-button" onClick={onContinue} ref={actionRef}><ArrowsClockwise size={20} weight="bold" aria-hidden="true" /> {advancing ? "Continuar no campeonato" : "Ver campeonato"}</button></div></motion.section></motion.div>;
}

function BattleResultModal({
  won,
  reward,
  coins,
  mode,
  onRematch,
  tournamentContext,
  wagerResult,
}) {
  const rematchRef = useRef(null);
  useEffect(() => {
    const focusFrame = requestAnimationFrame(() => rematchRef.current?.focus());
    return () => cancelAnimationFrame(focusFrame);
  }, []);
  if (tournamentContext) return <TournamentBattleResultModal won={won} context={tournamentContext} onContinue={onRematch} actionRef={rematchRef} />;
  const isPerfect =
    reward.bonuses.fastVictory > 0 && reward.bonuses.onePokemonVictory > 0;
  const rematchLabel =
    mode === "tournament"
      ? "Voltar ao campeonato"
      : mode === "friend"
        ? "Pedir revanche"
        : "Jogar novamente";
  const droppedItem = reward.itemId ? getItemDefinition(reward.itemId) : null;

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
          {won ? (
            <Trophy size={32} weight="fill" />
          ) : (
            <WarningCircle size={32} weight="fill" />
          )}
        </div>
        <span className="result-modal__eyebrow">
          {won ? "VOCÊ VENCEU" : "DERROTA"}
        </span>
        <h2 id="battle-result-title">
          {won ? "Vitória!" : "Não foi dessa vez!"}
        </h2>
        <p id="battle-result-description">
          {won
            ? "Seu time venceu!"
            : "Ajuste sua estratégia e tente novamente."}
        </p>

        {wagerResult && (
          <section
            className={`result-modal__wager is-${wagerResult.status.toLowerCase()}`}
            aria-label={`Resultado da aposta: ${wagerResult.status === "WON" ? "ganhou" : wagerResult.status === "LOST" ? "perdeu" : "devolvida"}`}
          >
            <img
              src="/coin.png"
              alt=""
              aria-hidden="true"
              width="30"
              height="30"
            />
            <div>
              <span>APOSTA · POTE {formatCoins(wagerResult.pot)}</span>
              <strong>
                {wagerResult.status === "WON"
                  ? `Você recebeu ${formatCoins(wagerResult.pot)}`
                  : wagerResult.status === "LOST"
                    ? `Você perdeu ${formatCoins(wagerResult.amount)}`
                    : `Aposta devolvida: ${formatCoins(wagerResult.amount)}`}
              </strong>
              {wagerResult.status !== "REFUNDED" && (
                <small>
                  Resultado líquido: {wagerResult.net > 0 ? "+" : ""}
                  {formatCoins(wagerResult.net)} moedas
                </small>
              )}
            </div>
          </section>
        )}

        {won ? (
          <>
            {isPerfect && (
              <span className="result-modal__perfect">
                Performance perfeita
              </span>
            )}
            <section
              className="result-modal__reward"
              aria-live="polite"
              aria-label={`Você recebeu ${reward.total} moedas`}
            >
              <img
                src="/coin.png"
                alt=""
                aria-hidden="true"
                width="42"
                height="42"
              />
              <div>
                <AnimatedReward value={reward.total} />
                <span>MOEDAS</span>
              </div>
            </section>
            <section
              className="result-modal__breakdown"
              aria-label="Detalhes das recompensas"
            >
              <span className="result-modal__section-label">RECOMPENSAS</span>
              <ul>
                <RewardRow icon={Sword} label="Vitória" value={reward.base} />
                {reward.bonuses.fastVictory > 0 && (
                  <RewardRow
                    icon={Lightning}
                    label="Vitória rápida"
                    value={reward.bonuses.fastVictory}
                  />
                )}
                {reward.bonuses.onePokemonVictory > 0 && (
                  <RewardRow
                    icon={Trophy}
                    label="Um Pokémon só"
                    value={reward.bonuses.onePokemonVictory}
                  />
                )}
                {reward.bonuses.champion > 0 && (
                  <RewardRow
                    icon={Crown}
                    label="Bônus de Campeão"
                    value={reward.bonuses.champion}
                  />
                )}
                {droppedItem && (
                  <li
                    className={`cpu-result-drop rarity-${droppedItem.rarity.toLowerCase()}`}
                  >
                    <span>
                      <ItemSprite item={droppedItem.id} alt="" /> Item{" "}
                      {droppedItem.name}
                    </span>
                    <strong>{droppedItem.rarity}</strong>
                  </li>
                )}
              </ul>
              <div className="result-modal__balance">
                <span>Saldo atual</span>
                <strong>
                  <img
                    src="/coin.png"
                    alt=""
                    aria-hidden="true"
                    width="18"
                    height="18"
                  />{" "}
                  {formatCoins(coins)}
                </strong>
              </div>
            </section>
          </>
        ) : (
          <div className="result-modal__defeat-note">
            <img
              src="/coin.png"
              alt=""
              aria-hidden="true"
              width="24"
              height="24"
            />
            <span>
              <strong>+0 moedas</strong> Você não perdeu moedas.
            </span>
          </div>
        )}

        <div className="result-modal__actions">
          <button
            type="button"
            className="rematch-button"
            onClick={onRematch}
            ref={rematchRef}
          >
            <ArrowsClockwise size={20} weight="bold" aria-hidden="true" />{" "}
            {rematchLabel}
          </button>
          <Link href={won ? "/loja" : "/pokedex"} className="result-link">
            {won ? "Ir para a Loja Pokémon" : "Ver Pokédex"}
          </Link>
        </div>
      </motion.section>
    </motion.div>
  );
}

function BattleEnvironment({ background }) {
  return (
    <div className="battle-environment" aria-hidden="true">
      <div
        className="battle-environment__layer battle-environment__forest"
        data-parallax-layer="forest"
        style={
          background
            ? { "--arena-background": `url("${background}")` }
            : undefined
        }
      />
      <div
        className="battle-environment__layer battle-environment__light"
        data-parallax-layer="light"
      />
      <div
        className="battle-environment__layer battle-environment__fog"
        data-parallax-layer="fog"
      />
      <div
        className="battle-environment__layer battle-environment__particles"
        data-parallax-layer="particles"
      >
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div
        className="battle-environment__layer battle-environment__foreground"
        data-parallax-layer="foreground"
      />
    </div>
  );
}

export default function BattleArena({
  state,
  role,
  mode,
  inventory = {},
  inventoryStatus = "ready",
  onAction,
  onRematch,
  tournamentContext = null,
  badgeContext = null,
  championBonusEligible = false,
}) {
  const [actionMode, setActionMode] = useState("moves");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const coins = useSelector((store) => store.economy.coins);
  const me = state[role];
  const opponentRole = role === "host" ? "guest" : "host";
  const opponent = state[opponentRole];
  const myTurn = state.turn === role && state.status === "playing";
  const effect = state.effect;
  const latestStatusEvent =
    [...(effect?.statusEvents || [])]
      .reverse()
      .find((event) => event.type !== "STATUS_ATTEMPTED") || null;
  const active = me.team[me.active];
  const enemy = opponent.team[opponent.active];
  // PvP battle state deliberately excludes both players' persistent Bag
  // quantities. Render the owning browser's hydrated IndexedDB inventory
  // instead; CPU state continues to use the public engine bag.
  const bag = me.privateBag ? inventory : (me.bag || {});
  const inventoryLoading = me.privateBag && inventoryStatus === "loading";
  const inventoryError = me.privateBag && inventoryStatus === "error";
  const itemCount = Object.values(bag).reduce(
    (total, amount) => total + amount,
    0,
  );
  const selectedDefinition = selectedItem ? getItemDefinition(selectedItem) : null;
  const selectedTargetsEnemy = ["ENEMY_ACTIVE", "ENEMY_SIDE"].includes(selectedDefinition?.battleUsage?.target);
  const selectedTargets = selectedTargetsEnemy ? opponent.team : me.team;
  const selectedActiveIndex = selectedTargetsEnemy ? opponent.active : me.active;
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    console.info("[Battle Items]", {
      localPlayerId: me.id,
      localSide: role,
      hostPlayerId: state.host?.id,
      guestPlayerId: state.guest?.id,
      inventoryStatus,
      inventoryItemCount: Object.values(bag).reduce((total, amount) => total + Number(amount || 0), 0),
      availableBagItems: Object.entries(bag).filter(([, amount]) => Number(amount) > 0).map(([itemId]) => itemId),
      battleUsage: active?.bagUsage,
    });
  }, [active?.bagUsage, bag, inventoryStatus, me.id, role, state.guest?.id, state.host?.id]);
  const activeMatchup = getPokemonMatchup(active, enemy);
  const elapsed = useBattleElapsed(
    state.performance?.startedAt,
    state.status === "playing",
  );
  const fastAvailable = elapsed < 60_000;
  const onePokemonAvailable = !state.performance?.players?.[role]?.hasSwitched;
  const normalReward = calculateBattleRewards({
    won: state.status === "finished" && state.winner === role,
    durationMs:
      (state.performance?.endedAt || 0) - (state.performance?.startedAt || 0),
    usedOnlyOnePokemon: !state.performance?.players?.[role]?.hasSwitched,
    championBonusEligible,
    baseCoins: mode === "cpu" ? state.cpuReward?.baseCoins : undefined,
  });
  const victoryReward = tournamentContext
    ? {
        base: tournamentContext.reward,
        bonuses: { fastVictory: 0, onePokemonVictory: 0, champion: 0 },
        total: tournamentContext.reward,
      }
    : {
        ...normalReward,
        itemId: mode === "cpu" ? state.cpuReward?.itemId || null : null,
      };
  const wagerResult =
    mode === "friend" ? getWagerResult(state.wager, state.winner, role) : null;
  const performanceRewardsVisible = mode === "cpu" || mode === "friend";
  const arenaRef = useBattleParallax(
    state.status === "playing" || state.status === "countdown",
  );
  useEffect(() => {
    if (!selectedStatus) return;
    const current = [...me.team, ...opponent.team].find(
      (pokemon) => String(pokemon.id) === String(selectedStatus.pokemon.id),
    );
    if (!current?.status || current.status.id !== selectedStatus.status.id)
      setSelectedStatus(null);
  }, [state.revision, selectedStatus, me.team, opponent.team]);
  return (
    <>
      <section
        ref={arenaRef}
        className={`battle-arena arena-${myTurn ? "ready" : "waiting"}`}
        aria-label="Arena de batalha"
      >
        <BattleEnvironment background={state.arenaBackground} />
        <div className="persistent-turn" aria-hidden="true">
          {myTurn
            ? "SUA VEZ"
            : state.status === "countdown"
              ? "PREPARE-SE"
              : `VEZ DE ${opponent.name.toUpperCase()}`}
        </div>
        {performanceRewardsVisible && (
          <div className="battle-challenges" aria-label="Desafios da batalha">
            <span className={fastAvailable ? "" : "is-lost"}>
              ⏱ {String(Math.floor(elapsed / 60000)).padStart(2, "0")}:
              {String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")} ⚡ +15
            </span>
            <span className={onePokemonAvailable ? "" : "is-lost"}>🏆 +30</span>
          </div>
        )}
        {mode === "friend" && state.wager?.status === "LOCKED" && (
          <div
            className="battle-wager-pot"
            aria-label={`Pote da aposta: ${state.wager.amount * 2} moedas`}
          >
            🏆 POTE · 🪙 {state.wager.amount * 2}
          </div>
        )}
        <div className="battle-status-stack" aria-label="Estado das equipes">
          <TeamStrip
            player={opponent}
            label={opponent.name === "CPU" ? "CPU" : opponent.name}
            side="opponent"
          />
          <TeamStrip player={me} label="VOCÊ" side="player" />
        </div>
        <div className="arena-stage">
          <Fighter
            matchId={state.matchId}
            battleStatus={state.status}
            revision={state.revision}
            side="opponent"
            player={opponent}
            effect={effect}
            isHit={effect?.kind === "attack" && effect?.target === opponentRole}
            isAttacking={effect?.actor === opponentRole}
            statusEvent={
              latestStatusEvent?.targetPokemonId ===
              opponent.team[opponent.active].id
                ? latestStatusEvent
                : null
            }
            onStatusOpen={setSelectedStatus}
            isHealing={
              effect?.kind === "item" &&
              effect?.healing > 0 &&
              effect?.target === opponentRole &&
              effect?.targetPokemonId === opponent.team[opponent.active].id
            }
          />
          <div className="arena-divider">
            <span>VS</span>
          </div>
          <Fighter
            matchId={state.matchId}
            battleStatus={state.status}
            revision={state.revision}
            side="player"
            player={me}
            effect={effect}
            isHit={effect?.kind === "attack" && effect?.target === role}
            isAttacking={effect?.actor === role}
            statusEvent={
              latestStatusEvent?.targetPokemonId === me.team[me.active].id
                ? latestStatusEvent
                : null
            }
            onStatusOpen={setSelectedStatus}
            isHealing={
              effect?.kind === "item" &&
              effect?.healing > 0 &&
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
        <AnimatePresence>
          {selectedStatus && (
            <StatusDetails
              selection={selectedStatus}
              onClose={() => setSelectedStatus(null)}
            />
          )}
        </AnimatePresence>
      </section>
      <section className={`battle-controls ${myTurn ? "is-active" : ""}`}>
        <div
          className="action-tabs"
          role="tablist"
          aria-label="Ações da batalha"
        >
          <button
            type="button"
            role="tab"
            aria-selected={actionMode === "moves"}
            className={actionMode === "moves" ? "selected" : ""}
            onClick={() => {
              setActionMode("moves");
              setSelectedItem(null);
            }}
          >
            <Sword size={16} weight="fill" aria-hidden="true" /> Sua ação
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={actionMode === "items"}
            className={actionMode === "items" ? "selected" : ""}
            onClick={() => {
              setActionMode("items");
              setSelectedItem(null);
            }}
          >
            <Backpack size={16} weight="fill" aria-hidden="true" /> Itens{" "}
            <span>{itemCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={actionMode === "switch"}
            className={actionMode === "switch" ? "selected" : ""}
            onClick={() => {
              setActionMode("switch");
              setSelectedItem(null);
            }}
          >
            <ArrowsClockwise size={16} weight="bold" aria-hidden="true" />{" "}
            Trocar
          </button>
        </div>
        <div className="action-deck-panel">
          {actionMode === "moves" && (
            <>
              <div className="momentum-indicator" aria-label={`Impulso: ${active.momentum || 0} de 3`}>
                <Lightning size={13} weight="fill" aria-hidden="true" />
                <span>IMPULSO</span>
                <b>{active.momentum || 0}/3</b>
              </div>
            <div
              className="attack-grid v2-move-grid"
              role="tabpanel"
              aria-label="Golpes disponíveis"
            >
              {Array.from(
                { length: 4 },
                (_, index) => active.moves[index] || null,
              ).map((move, index) => {
                if (!move)
                  return (
                    <div
                      key={`empty-${index}`}
                      className="move-slot-empty"
                      aria-hidden="true"
                    >
                      <span>＋</span>
                      <small>Indisponível</small>
                    </div>
                  );
                const attackType =
                  move.type === "own" ? active.type : move.type;
                const decision = analyzeMoveDecision({
                  attacker: active,
                  defender: enemy,
                  move,
                });
                const preview = getDamagePreview({ attacker: active, defender: enemy, move });
                const strong =
                  decision.effectiveness > 1 && !decision.blockedByAbility;
                const weak =
                  decision.effectiveness < 1 && !decision.blockedByAbility;
                const uses = active.specialAttackUsesRemaining ?? 0;
                const exhausted = move.special && uses <= 0;
                const effectiveness = decision.blockedByAbility
                  ? "BLOQUEADO"
                  : strong
                    ? "▲ FORTE"
                    : weak
                      ? "▼ FRACO"
                      : "● NORMAL";
                const strategistDetail =
                  active.heldItem === "strategist-eye"
                    ? ` · ×${multiplier(attackType, enemy).toFixed(2)}`
                    : "";
                const moveStatus = getStatusDefinition(move.statusEffect);
                const moveStatusChance = move.statusEffect
                  ? Math.round(move.statusEffect.chance * 100)
                  : null;
                return (
                  <button
                    type="button"
                    key={move.id}
                    className={`attack-button ${weak ? "disadvantage" : ""} ${decision.blockedByAbility ? "is-blocked" : ""} ${decision.decisionSeverity === "RISK" ? "has-risk" : ""} ${move.special ? "is-special" : ""} ${exhausted ? "is-exhausted" : ""}`}
                    disabled={!myTurn || exhausted}
                    onClick={() => {
                      playBattleSound(
                        move.special ? "golpe-normal" : "investida",
                      );
                      onAction({ type: "attack", moveId: move.id });
                    }}
                    aria-label={`${move.name}. ${preview.blocked ? "Nao atinge" : `${preview.minDamage}${preview.maxDamage !== preview.minDamage ? ` a ${preview.maxDamage}` : ""} de dano. ${effectiveness}`}${move.special ? (exhausted ? " Especial esgotado." : ` Especial, ${uses} de ${MAX_SPECIAL_ATTACK_USES} usos.`) : ""}${move.role === "FAST" ? " Gera 1 Impulso." : move.role === "TECHNICAL" ? ` Usa ${active.momentum || 0} de ${MOMENTUM_CONFIG.MAX} Impulso.` : ""}${decision.makesContact ? " Golpe de contato." : ""}${decision.warnings.map((warning) => ` ${warning.ability?.namePtBr || warning.detail}. ${warning.detail}`).join("")}${moveStatus ? `. ${moveStatusChance}% de chance de causar ${moveStatus.eventName}` : ""}.`}
                  >
                    <span className="attack-icon">
                      <PokemonTypeIcon type={attackType} size={22} decorative />
                    </span>
                    <span className="attack-copy">
                      <span className="move-card-header"><strong>{move.name}</strong></span>
                      <span className={`damage-preview ${preview.blocked ? "is-blocked" : ""}`}>
                        {preview.blocked ? <span className="damage-blocked">NÃO ATINGE</span> : (
                          <><span className="damage-value">{preview.minDamage}{preview.maxDamage !== preview.minDamage ? `\u2013${preview.maxDamage}` : ""}</span><span className="damage-label">DANO</span><span className="move-effectiveness">{effectiveness}{strategistDetail}</span></>
                        )}
                      </span>
                      {(move.special || move.role === "FAST" || move.role === "TECHNICAL" || moveStatus || ((decision.makesContact || decision.contactRelevant) && !decision.contactRisk)) && <span className="move-tactical-row">
                        {move.special && <small className="special-meta">{exhausted ? "ESGOTADO" : `ESPECIAL · ${uses}/${MAX_SPECIAL_ATTACK_USES}`}</small>}
                        {!move.special && move.role === "FAST" && <small className="momentum-move"><Lightning size={11} weight="fill" aria-hidden="true" /> +1 IMPULSO</small>}
                        {!move.special && move.role === "TECHNICAL" && <small className="momentum-move"><Lightning size={11} weight="fill" aria-hidden="true" /> {active.momentum ? `+${active.momentum * 10}% IMPULSO` : `IMPULSO 0/${MOMENTUM_CONFIG.MAX}`}</small>}
                        {moveStatus && <small className={`move-status-hint is-${moveStatus.id}`}><StatusIcon status={moveStatus.id} size={11} aria-hidden="true" /> <span>{moveStatusChance}% {moveStatus.eventName}</span></small>}
                        {(decision.makesContact || decision.contactRelevant) && !decision.contactRisk && <span className="move-contact-hint">{decision.makesContact ? "CONTATO" : "SEM CONTATO"}</span>}
                      </span>}
                      {decision.warnings
                        .slice(0, 1)
                        .map((warning, warningIndex) => (
                          <small
                            key={`${warning.kind}-${warning.ability?.id || warningIndex}`}
                            className={`move-decision-hint is-${warning.kind}`}
                          >
                            {warning.kind === "blocked" ? (
                              <WarningCircle
                                size={12}
                                weight="fill"
                                aria-hidden="true"
                              />
                            ) : warning.kind === "boost" ? (
                              <Lightning
                                size={12}
                                weight="fill"
                                aria-hidden="true"
                              />
                            ) : (
                              <WarningCircle
                                size={12}
                                weight="fill"
                                aria-hidden="true"
                              />
                            )}
                            <span>
                              {warning.kind === "blocked"
                                ? warning.ability?.namePtBr?.toUpperCase() ||
                                  "BLOQUEADO"
                                : warning.kind === "boost"
                                  ? `${warning.ability.namePtBr.toUpperCase()} ATIVO`
                                  : warning.ability?.namePtBr?.toUpperCase() ||
                                    warning.detail}
                            </span>
                            <em>{warning.detail}</em>
                          </small>
                        ))}
                    </span>
                  </button>
                );
              })}
            </div>
            </>
          )}
          {actionMode === "items" && (
            <div
              className="deck-items"
              role="tabpanel"
              aria-label="Itens de batalha"
            >
              {inventoryLoading ? <p className="battle-items-state" role="status">Carregando itens...</p> : inventoryError ? <p className="battle-items-state is-error" role="alert">NÃ£o foi possÃ­vel carregar os itens da mochila.</p> : selectedItem ? (
                <>
                  {(() => {
                    const definition = getItemDefinition(selectedItem);
                    const usage = getBagItemUsage(active, definition);
                    return (
                  <div className="deck-panel-heading">
                    <button type="button" onClick={() => setSelectedItem(null)}>
                      Voltar
                    </button>
                    <strong>Escolha o alvo · ×{bag[selectedItem] || 0} estoque · usos {usage.itemUsed}/{usage.itemLimit}</strong>
                  </div>
                    );
                  })()}
                  <div className="deck-target-list">
                    {selectedTargets.map((pokemon, index) => {
                      const definition = getItemDefinition(selectedItem);
                      const activeTarget = index === selectedActiveIndex;
                      const usage = getBagItemUsage(pokemon, definition);
                      const blockReason = getBagItemUseBlockReason(pokemon, definition, { activeTarget });
                      const unavailable = Boolean(blockReason);
                      return (
                        <button
                          type="button"
                          key={`${pokemon.id}-${index}`}
                          disabled={!myTurn || unavailable}
                          onClick={() => {
                            onAction({
                              type: "item",
                              itemId: selectedItem,
                              targetPokemonId: pokemon.id,
                            });
                            setSelectedItem(null);
                            setActionMode("moves");
                          }}
                        >
                          <PokemonImage
                            pokemon={pokemon}
                            context={SPRITE_CONTEXT.BATTLE_THUMBNAIL}
                            alt=""
                          />
                          <span>
                            <strong>{pokemon.name}</strong>
                            <small>
                              {unavailable
                                ? getBagBlockLabel(blockReason)
                                : definition.effectType === "BAG_CURE"
                                  ? `Curar ${getStatusLabel(pokemon.status.id)}`
                                  : definition.effectType === "BAG_RECHARGE"
                                    ? `${pokemon.specialAttackUsesRemaining}/2 usos Especiais`
                                    : `${pokemon.hp}/${pokemon.maxHp} HP`} · usos {usage.itemUsed}/{usage.itemLimit} · mochila {usage.totalUsed}/{usage.totalLimit}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="bag-usage-heading">
                    <span>MOCHILA</span>
                    <strong>{getBagItemUsage(active, BAG_ITEM_CATALOG[0]).totalUsed}/{MAX_BAG_ITEM_USES_PER_POKEMON}</strong>
                    <small>{getBagItemUsage(active, BAG_ITEM_CATALOG[0]).totalUsed >= MAX_BAG_ITEM_USES_PER_POKEMON ? "LIMITE ATINGIDO" : "usos nesta batalha"}</small>
                  </div>
                <div className="deck-item-grid">
                  {BAG_ITEM_CATALOG.map((item) => {
                    const usage = getBagItemUsage(active, item);
                    const activeStatus = getStatusDefinition(active.status);
                    const contextualDescription =
                      item.effectType === "BAG_CURE" && activeStatus
                        ? `Remove ${activeStatus.eventName}`
                        : item.shortDescription;
                    const blockReason = getBagItemUseBlockReason(active, item);
                    const targetsEnemy = ["ENEMY_ACTIVE", "ENEMY_SIDE"].includes(item.battleUsage?.target);
                    const targetTeam = targetsEnemy ? opponent.team : me.team;
                    const targetActive = targetsEnemy ? opponent.active : me.active;
                    const hasUsableTarget = targetTeam.some((pokemon, index) =>
                      !getBagItemUseBlockReason(pokemon, item, { activeTarget: index === targetActive }),
                    );
                    return (
                      <button
                        type="button"
                        key={item.id}
                        disabled={!myTurn || !bag[item.id] || !hasUsableTarget}
                        onClick={() => setSelectedItem(item.id)}
                        aria-label={`${item.name}. ${bag[item.id]} em estoque. ${usage.itemUsed} de ${usage.itemLimit} usos nesta batalha.${!hasUsableTarget && blockReason ? ` ${getBagBlockLabel(blockReason)}.` : ""}`}
                      >
                        <ItemSprite item={item.id} alt={item.name} />
                        <span>
                          <strong>{item.name}</strong>
                          <small>{!bag[item.id] ? "ESTOQUE ESGOTADO" : !hasUsableTarget && blockReason ? getBagBlockLabel(blockReason) : contextualDescription}</small>
                          <small className="bag-item-usage">USOS {usage.itemUsed}/{usage.itemLimit}</small>
                        </span>
                        <b>×{bag[item.id] || 0}</b>
                      </button>
                    );
                  })}
                </div>
                </>
              )}
            </div>
          )}
          {actionMode === "switch" && (
            <div
              className="deck-switch-list"
              role="tabpanel"
              aria-label="Trocar Pokémon"
            >
              {me.team.map((pokemon, index) => {
                const matchup = getPokemonMatchup(pokemon, enemy);
                const activeSlot = index === me.active;
                const fainted = pokemon.hp <= 0;
                return (
                  <button
                    type="button"
                    key={`${pokemon.id}-${index}`}
                    className={`${activeSlot ? "active" : ""} ${fainted ? "fainted" : ""} ${matchup}`}
                    disabled={!myTurn || activeSlot || fainted}
                    onClick={() => {
                      onAction({ type: "switch", index });
                      setActionMode("moves");
                    }}
                    aria-label={`${pokemon.name}: ${activeSlot ? "ativo" : fainted ? "desmaiado" : "disponível para troca"}`}
                  >
                    <PokemonImage
                      pokemon={pokemon}
                      context={SPRITE_CONTEXT.BATTLE_THUMBNAIL}
                      alt=""
                    />
                    <span>
                      <strong>{pokemon.name}</strong>
                      <small>
                        {activeSlot
                          ? "Ativo"
                          : fainted
                            ? "Desmaiado"
                            : `${pokemon.hp}/${pokemon.maxHp} HP`}
                      </small>
                      {pokemon.status && (
                        <small
                          className={`switch-status is-${pokemon.status.id}`}
                        >
                          <StatusIcon status={pokemon.status.id} size={12} />{" "}
                          {getStatusLabel(pokemon.status.id)}
                        </small>
                      )}
                    </span>
                    {!activeSlot && !fainted && (
                      <em>
                        {matchup === "advantage"
                          ? "▲ Vantagem"
                          : matchup === "disadvantage"
                            ? "▼ Desvantagem"
                            : "● Neutro"}
                      </em>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
      <AnimatePresence>
        {state.status === "finished" &&
          (badgeContext ? (
            <BadgeBattleResultModal
              won={state.winner === role}
              badgeContext={badgeContext}
              onRematch={onRematch}
            />
          ) : (
            <BattleResultModal
              won={state.winner === role}
              reward={victoryReward}
              coins={coins}
              mode={mode}
              onRematch={onRematch}
              tournamentContext={tournamentContext}
              wagerResult={wagerResult}
            />
          ))}
      </AnimatePresence>
    </>
  );
}
