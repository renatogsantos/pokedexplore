"use client";

import {
  ArrowsClockwise,
  Backpack,
  Crown,
  Lightning,
  Sword,
  Trophy,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  getOpponentWeaknesses,
  MAX_HEALS_PER_POKEMON,
  getPokemonMatchup,
  getSupportedAbility,
  multiplier,
} from "@/lib/battle/engine";
import {
  getPokemonArtwork,
  getReserveSprite,
  getShowdownThumbnail,
} from "@/lib/battle/pokemon";
import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";
import { playBattleSound } from "@/lib/battle/sound";
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
import { BAG_ITEM_CATALOG, getItemDefinition } from "@/lib/items/catalog";
import { getStatusDefinition } from "@/lib/battle/statuses";
import StatusIcon from "@/components/Battle/StatusIcon";

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

function Fighter({ side, player, isHit, isAttacking, isHealing, matchup, statusEvent, onStatusOpen }) {
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
        <small className="healing-limit-indicator combatant-label">
          Curas {pokemon.healsUsed || 0}/{MAX_HEALS_PER_POKEMON}
        </small>
        {ability && (
          <span
            className={`battle-ability ${pokemon.hp / pokemon.maxHp <= 1 / 3 ? "is-active" : ""}`}
            title={ability.description}
          >
            {ability.id}
          </span>
        )}
        {pokemon.heldItem && (
          <span
            className="held-item-indicator"
            title="Item equipado: ativa conforme sua condição."
          >
            <ItemSprite
              item={pokemon.heldItem}
              alt=""
              className="battle-held-indicator-sprite"
            />
            {getItemLabel(pokemon.heldItem)} <b>PRONTO</b>
          </span>
        )}
        {pokemon.status && <StatusBadge pokemon={pokemon} onOpen={onStatusOpen} />}
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
          <span className={`status-vfx is-${statusEvent.status} is-${statusEvent.type.toLowerCase()}`} aria-hidden="true">
            <StatusIcon status={statusEvent.status} size={28} />
            <i /><i /><i />
          </span>
        )}
        <PokemonAura
          pokemon={pokemon}
          variant="battle"
          className="fighter-aura"
        >
          <motion.img
            animate={{ y: [0, -5, 0] }}
            transition={{
              repeat: Infinity,
              duration: side === "player" ? 2.4 : 2.8,
            }}
            src={getPokemonSprite({
              pokemon,
              context: SPRITE_CONTEXT.BATTLE_ACTIVE,
            })}
            alt={pokemon.name}
          />
        </PokemonAura>
      </div>
    </div>
  );
}

function TeamStrip({ player, label }) {
  const remaining = player.team.filter((pokemon) => pokemon.hp > 0).length;
  return (
    <div
      className="team-strip"
      aria-label={`${label}: ${remaining} Pokémon disponíveis`}
    >
      <span>
        {label} · {remaining}/3
      </span>
      <div>
        {player.team.map((pokemon, index) => (
          <div
            key={`${pokemon.id}-${index}`}
            className={`team-slot ${index === player.active ? "active" : ""} ${pokemon.hp <= 0 ? "fainted" : ""} ${pokemon.status ? "has-status" : ""}`}
            aria-label={`${pokemon.name}: ${pokemon.hp <= 0 ? "desmaiado" : index === player.active ? "ativo" : "disponível"}${pokemon.status ? `, ${getStatusLabel(pokemon.status.id)}` : ""}`}
          >
            <img src={getShowdownThumbnail(pokemon)} alt="" />
            <small>
              {pokemon.hp <= 0
                ? "KO"
                : pokemon.status
                  ? <StatusIcon status={pokemon.status.id} size={9} />
                  : ""}
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
  if (!event || event.type === "STATUS_ATTEMPTED" || !event.successful && event.type !== "STATUS_PREVENTED") return null;
  const definition = getStatusDefinition(event.status);
  if (!definition) return null;
  if (event.type === "STATUS_APPLIED") return {
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
  if (event.type === "STATUS_TRIGGERED") return {
    title: definition.eventName.toUpperCase(),
    detail: event.status === "sleep" ? `${event.targetPokemonName} continua dormindo e não pode atacar neste turno.` : `${event.targetPokemonName} não conseguiu se mover!`,
    tone: `status is-${definition.id}`,
    status: definition.id,
    duration: 1250,
  };
  if (event.type === "STATUS_DAMAGE") return {
    title: definition.eventName.toUpperCase(),
    detail: `-${event.damage} HP em ${event.targetPokemonName}.`,
    tone: `status is-${definition.id}`,
    status: definition.id,
    duration: 950,
  };
  if (event.type === "STATUS_CURED") return {
    title: getCureTitle(event.status),
    detail: `${getItemLabel(event.itemId) || "O item"} curou ${event.targetPokemonName}.`,
    tone: "healing",
    itemId: event.itemId,
    duration: 1100,
  };
  if (event.type === "STATUS_EXPIRED") return {
    title: "ACORDOU!",
    detail: `${event.targetPokemonName} pode agir novamente.`,
    tone: "healing",
    duration: 1050,
  };
  if (event.type === "STATUS_PREVENTED") return {
    title: "STATUS EVITADO!",
    detail: `${getItemLabel(event.itemId)} protegeu ${event.targetPokemonName}.`,
    tone: "healing",
    itemId: event.itemId,
    duration: 1050,
  };
  return null;
}

function buildBattleNotifications(state, role, opponentName) {
  if (state.status === "countdown") return [{ title: "3 · 2 · 1", detail: "BATALHA!", tone: "turn", duration: 1450 }];
  if (state.status === "finished") return [{ title: "BATALHA ENCERRADA", detail: state.log, tone: "result", duration: 1400 }];
  const effect = state.effect;
  if (!effect) return [state.turn === role
    ? { title: "SUA VEZ!", detail: "Escolha um ataque", tone: "turn", duration: 1050 }
    : { title: `VEZ DE ${opponentName.toUpperCase()}`, detail: "Aguardando adversário...", tone: "waiting", duration: 1050 }];
  const queue = [];
  if (["attack", "miss"].includes(effect.kind) && effect.moveName) queue.push({ title: `${effect.sourcePokemonName?.toUpperCase() || "POKÉMON"} USOU ${effect.moveName.toUpperCase()}!`, detail: effect.kind === "miss" ? "O golpe não acertou." : "Golpe em execução", tone: "move", duration: 800 });
  if (effect.kind === "attack" && effect.damage > 0) queue.push({ title: `-${effect.damage} HP`, detail: effect.effective ? "SUPER EFETIVO!" : `${effect.targetPokemonName} recebeu o golpe.`, tone: effect.effective ? "strong" : "damage", duration: 850 });
  for (const event of effect.statusEvents || []) {
    const notification = statusNotification(event);
    if (notification) queue.push(notification);
  }
  const cureHandled = (effect.statusEvents || []).some((event) => ["STATUS_CURED", "STATUS_PREVENTED"].includes(event.type));
  if (effect.heldItem && !cureHandled) {
    const definition = getItemDefinition(effect.heldItem.itemId);
    queue.push({ title: `${(definition?.name || getItemLabel(effect.heldItem.itemId)).toUpperCase()} ATIVADO!`, detail: effect.heldItem.effect?.amount ? `+${effect.heldItem.effect.amount} HP · item consumido` : "Item consumido", tone: definition?.rarity === "LEGENDARY" ? "strong" : "healing", itemId: effect.heldItem.itemId, duration: 900 });
  } else if (effect.itemEvents?.length && !cureHandled) {
    const item = effect.itemEvents[0]; const definition = getItemDefinition(item.itemId);
    queue.push({ title: (definition?.name || getItemLabel(item.itemId)).toUpperCase(), detail: item.effect?.amount ? `+${item.effect.amount} HP` : definition?.shortDescription || "Efeito ativado", tone: "turn", itemId: item.itemId, duration: 900 });
  }
  if (effect.ability && !queue.some((entry) => entry.status)) queue.push({ title: `${effect.ability.toUpperCase()}!`, detail: "Habilidade ativada", tone: "strong", duration: 900 });
  if (effect.kind === "item" && !cureHandled) queue.push({ title: effect.itemName?.toUpperCase() || "ITEM USADO!", detail: `×${effect.remaining} restante${effect.remaining === 1 ? "" : "s"}`, tone: effect.healing ? "healing" : "strong", itemId: effect.itemId, duration: 1050 });
  if (effect.kind === "switch") queue.push({ title: "TROCA!", detail: state.log, tone: "turn", duration: 1050 });
  return queue.length ? queue : [{ title: state.turn === role ? "SUA VEZ!" : `VEZ DE ${opponentName.toUpperCase()}`, detail: state.log, tone: "turn", duration: 1050 }];
}

function BattleNotification({ state, role, opponentName }) {
  const [notification, setNotification] = useState(null);
  useEffect(() => {
    if (state.effect?.kind === "attack") playBattleSound("dano", 0.5);
    if (state.effect?.kind === "item" && state.effect?.healing) playBattleSound("healing-pokemon-sound", 0.5);
    if (state.status === "finished") playBattleSound(state.winner === role ? "win" : "lost", 0.62);
    const queue = buildBattleNotifications(state, role, opponentName);
    const timers = [];
    let elapsed = 0;
    queue.forEach((entry, index) => {
      timers.push(window.setTimeout(() => setNotification({ ...entry, index }), elapsed));
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
            {notification.status && <StatusIcon status={notification.status} size={24} />}
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
  const { config, challenge, resolution, resolving, playerId, error } = badgeContext;
  const status = resolution?.status || challenge?.status;
  const isChallenger = challenge?.challenger_player_id === playerId;
  const acquired = status === "COMPLETED";
  const defended = status === "FAILED";
  const active = status === "ACTIVE" && resolution && Number(resolution.current_battle) > Number(challenge?.current_battle || 0);
  useEffect(() => { const frame = requestAnimationFrame(() => actionRef.current?.focus()); return () => cancelAnimationFrame(frame); }, [resolving]);
  const title = resolving ? "Confirmando resultado..." : error ? "Resultado pendente" : acquired ? "Novo campeão!" : defended ? (challenge?.challenge_kind === "PVP_TAKEOVER" ? "Insígnia defendida" : "Desafio encerrado") : active ? (won ? "Vitória confirmada" : "O desafiante avançou") : "Batalha concluída";
  const description = acquired
    ? `${challenge?.challenger_name} conquistou a ${config.name} com ${BADGE_REQUIRED_WINS} vitórias consecutivas.`
    : defended
      ? challenge?.challenge_kind === "PVP_TAKEOVER" ? `${challenge?.defender_name} continua como campeão.` : `Você chegou a ${resolution?.challenger_wins || 0} de ${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas.`
      : active ? `${resolution?.challenger_wins || 0}/${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas. A equipe pode mudar antes da próxima batalha.` : "Aguarde a confirmação compartilhada antes de continuar.";
  const canContinue = !resolving && !error && (active || acquired || defended);
  return <motion.div className="result-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.section className={`result-card result-modal badge-result-modal ${acquired ? "is-victory is-champion" : defended && isChallenger ? "is-defeat" : "is-victory"}`} role="dialog" aria-modal="true" aria-labelledby="badge-battle-result-title" initial={{ opacity: 0, scale: .9, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 320, damping: 26 }}>
      <BadgeArtwork badge={config} />
      <span className="result-modal__eyebrow">DESAFIO DA INSÍGNIA</span>
      <h2 id="badge-battle-result-title">{title}</h2>
      <p>{description}</p>
      {!resolving && !error && <div className="badge-series-result" aria-label={`${resolution?.challenger_wins || 0} de ${challenge?.wins_required || BADGE_REQUIRED_WINS} vitórias consecutivas`}><div>{Array.from({ length: challenge?.wins_required || BADGE_REQUIRED_WINS }, (_, index) => <i key={index} className={index < (resolution?.challenger_wins || 0) ? "won" : ""} />)}</div><strong>{resolution?.challenger_wins || 0} / {challenge?.wins_required || BADGE_REQUIRED_WINS}</strong><span>{active && Number(resolution?.challenger_wins) === BADGE_REQUIRED_WINS - 1 ? "MATCH POINT" : acquired ? "SÉRIE PERFEITA" : defended ? "SÉRIE ENCERRADA" : "VITÓRIAS CONSECUTIVAS"}</span></div>}
      {error && <p className="badge-result-error">{error}</p>}
      <div className="result-modal__actions"><button ref={actionRef} type="button" className="rematch-button" onClick={onRematch} disabled={!canContinue}>{resolving ? "Confirmando..." : active ? "Preparar próxima batalha" : "Voltar às Insígnias"}</button></div>
    </motion.section>
  </motion.div>;
}

function StatusDetails({ selection, onClose }) {
  if (!selection) return null;
  const definition = getStatusDefinition(selection.status);
  if (!definition) return null;
  const source = selection.status.sourceMoveName ||
    (selection.status.sourceItemId ? getItemLabel(selection.status.sourceItemId) : null) ||
    (selection.status.sourceAbilityId ? `Habilidade ${selection.status.sourceAbilityId}` : null) ||
    selection.status.sourcePokemonName;
  return (
    <motion.section
      className={`status-detail-sheet is-${definition.id}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="status-detail-title"
      initial={{ opacity: 0, y: 10, scale: .97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: .98 }}
    >
      <button type="button" className="status-detail-close" onClick={onClose} aria-label="Fechar explicação do status"><X size={18} weight="bold" aria-hidden="true" /></button>
      <div className="status-detail-heading">
        <StatusIcon status={definition.id} size={24} />
        <div><small>CONDIÇÃO ATUAL</small><strong id="status-detail-title">{definition.displayName}</strong></div>
      </div>
      <p>{definition.battleDescription}</p>
      {source && <div className="status-detail-source"><span>CAUSADO POR</span><strong>{source}</strong></div>}
      <div className="status-detail-response"><span>COMO RESPONDER</span><p>{definition.strategicHint}</p></div>
    </motion.section>
  );
}

function BattleResultModal({ won, reward, coins, mode, onRematch, tournamentContext }) {
  const rematchRef = useRef(null);
  const isPerfect = reward.bonuses.fastVictory > 0 && reward.bonuses.onePokemonVictory > 0;
  const rematchLabel = mode === "tournament" ? "Voltar ao campeonato" : mode === "friend" ? "Pedir revanche" : "Jogar novamente";

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
                  <RewardRow icon={Crown} label="Bônus de Campeão" value={reward.bonuses.champion} />
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
        style={background ? { "--arena-background": `url("${background}")` } : undefined}
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
  const latestStatusEvent = [...(effect?.statusEvents || [])].reverse().find((event) => event.type !== "STATUS_ATTEMPTED") || null;
  const active = me.team[me.active];
  const enemy = opponent.team[opponent.active];
  const bag = me.bag || {};
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
  const normalReward = calculateBattleRewards({
    won: state.status === "finished" && state.winner === role,
    durationMs:
      (state.performance?.endedAt || 0) - (state.performance?.startedAt || 0),
    usedOnlyOnePokemon: !state.performance?.players?.[role]?.hasSwitched,
    championBonusEligible,
  });
  const victoryReward = tournamentContext ? { base: tournamentContext.reward, bonuses: { fastVictory: 0, onePokemonVictory: 0, champion: 0 }, total: tournamentContext.reward } : normalReward;
  const performanceRewardsVisible = mode === "cpu" || mode === "friend";
  const arenaRef = useBattleParallax(
    state.status === "playing" || state.status === "countdown",
  );
  useEffect(() => {
    if (!selectedStatus) return;
    const current = [...me.team, ...opponent.team].find((pokemon) => String(pokemon.id) === String(selectedStatus.pokemon.id));
    if (!current?.status || current.status.id !== selectedStatus.status.id) setSelectedStatus(null);
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
        {performanceRewardsVisible && <div className="battle-challenges" aria-label="Desafios da batalha">
          <span className={fastAvailable ? "" : "is-lost"}>
            ⏱ {String(Math.floor(elapsed / 60000)).padStart(2, "0")}:
            {String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")} ⚡ +15
          </span>
          <span className={onePokemonAvailable ? "" : "is-lost"}>🏆 +30</span>
        </div>}
        <div className="battle-status-stack" aria-label="Estado das equipes">
          <TeamStrip
            player={opponent}
            label={opponent.name === "CPU" ? "CPU" : opponent.name}
          />
          <TeamStrip player={me} label="VOCÊ" />
        </div>
        <div className="arena-stage">
          <Fighter
            side="opponent"
            player={opponent}
            isHit={effect?.kind === "attack" && effect?.target === opponentRole}
            isAttacking={effect?.actor === opponentRole}
            statusEvent={latestStatusEvent?.targetPokemonId === opponent.team[opponent.active].id ? latestStatusEvent : null}
            onStatusOpen={setSelectedStatus}
            isHealing={
              effect?.kind === "item" && effect?.healing > 0 &&
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
            statusEvent={latestStatusEvent?.targetPokemonId === me.team[me.active].id ? latestStatusEvent : null}
            onStatusOpen={setSelectedStatus}
            isHealing={
              effect?.kind === "item" && effect?.healing > 0 &&
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
          {selectedStatus && <StatusDetails selection={selectedStatus} onClose={() => setSelectedStatus(null)} />}
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
                const strong = multiplier(attackType, enemy) > 1;
                const weak = multiplier(attackType, enemy) < 1;
                const uses = active.specialAttackUsesRemaining ?? 0;
                const exhausted = move.special && uses <= 0;
                const effectiveness = strong
                  ? "▲ FORTE"
                  : weak
                    ? "▼ FRACO"
                    : "● NORMAL";
                const strategistDetail = active.heldItem === "strategist-eye" ? ` · ×${multiplier(attackType, enemy).toFixed(2)}` : "";
                const moveStatus = getStatusDefinition(move.statusEffect);
                const moveStatusChance = move.statusEffect ? Math.round(move.statusEffect.chance * 100) : null;
                return (
                  <button
                    type="button"
                    key={move.id}
                    className={`attack-button ${strong ? "recommended" : ""} ${weak ? "disadvantage" : ""} ${move.special ? "is-special" : ""} ${exhausted ? "is-exhausted" : ""}`}
                    disabled={!myTurn || exhausted}
                    onClick={() => {
                      playBattleSound(
                        move.special ? "golpe-normal" : "investida",
                      );
                      onAction({ type: "attack", moveId: move.id });
                    }}
                    aria-label={`${move.name}. ${move.special ? (exhausted ? "Especial esgotado" : `Especial, ${uses} de 2 usos`) : `${move.power} de poder, ${effectiveness}${strategistDetail}`}${moveStatus ? `. ${moveStatusChance}% de chance de causar ${moveStatus.eventName}` : ""}.`}
                  >
                    <span className="attack-icon">
                      <PokemonTypeIcon type={attackType} size={25} decorative />
                    </span>
                    <span className="attack-copy">
                      <strong>{move.name}</strong>
                      <small
                        className={
                          move.special ? "special-meta" : "attack-meta"
                        }
                      >
                        {move.special ? (
                          exhausted ? (
                            "ESGOTADO"
                          ) : (
                            `ESPECIAL · ${uses}/2`
                          )
                        ) : (
                          <>
                            <span>{move.power}</span>
                            <span>{effectiveness}{strategistDetail}</span>
                          </>
                        )}
                      </small>
                      {moveStatus && <small className={`move-status-hint is-${moveStatus.id}`}><StatusIcon status={moveStatus.id} size={11} /> {moveStatusChance}% {moveStatus.eventName}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {actionMode === "items" && (
            <div
              className="deck-items"
              role="tabpanel"
              aria-label="Itens de batalha"
            >
              {selectedItem ? (
                <>
                  <div className="deck-panel-heading">
                    <button type="button" onClick={() => setSelectedItem(null)}>
                      Voltar
                    </button>
                    <strong>Escolha o alvo · ×{bag[selectedItem] || 0}</strong>
                  </div>
                  <div className="deck-target-list">
                    {me.team.map((pokemon, index) => {
                      const definition = getItemDefinition(selectedItem);
                      const activeTarget = index === me.active;
                      const unavailable = pokemon.hp <= 0 ||
                        (definition.effectType === "BAG_HEAL" && (pokemon.hp >= pokemon.maxHp || pokemon.healsUsed >= MAX_HEALS_PER_POKEMON)) ||
                        (definition.effectType === "BAG_CURE" && !pokemon.status) ||
                        (["BAG_BARRIER", "BAG_STIMULANT"].includes(definition.effectType) && (!activeTarget || pokemon.temporaryEffects?.[definition.effectType === "BAG_BARRIER" ? "barrier" : "stimulant"])) ||
                        (definition.effectType === "BAG_RECHARGE" && (pokemon.specialAttackUsesRemaining >= 2 || pokemon.rechargeUsed));
                      return (
                        <button
                          type="button"
                          key={`${pokemon.id}-${index}`}
                          disabled={!myTurn || unavailable}
                          onClick={() => {
                            onAction({ type: "item", itemId: selectedItem, targetPokemonId: pokemon.id });
                            setSelectedItem(null);
                            setActionMode("moves");
                          }}
                        >
                          <img src={getReserveSprite(pokemon)} alt="" />
                          <span>
                            <strong>{pokemon.name}</strong>
                            <small>
                              {pokemon.hp <= 0
                                ? "Desmaiado"
                                : definition.effectType === "BAG_HEAL"
                                  ? pokemon.hp >= pokemon.maxHp ? "HP já está cheio" : pokemon.healsUsed >= MAX_HEALS_PER_POKEMON ? "Limite de curas atingido" : `${pokemon.hp}/${pokemon.maxHp} HP`
                                  : definition.effectType === "BAG_CURE" ? pokemon.status ? `Curar ${getStatusLabel(pokemon.status.id)}` : "Nenhum status para remover"
                                  : definition.effectType === "BAG_RECHARGE" ? pokemon.rechargeUsed ? "Recarga já usada neste Pokémon" : pokemon.specialAttackUsesRemaining >= 2 ? "Golpe Especial já está carregado" : `${pokemon.specialAttackUsesRemaining}/2 usos Especiais`
                                  : !activeTarget ? "Escolha o Pokémon ativo" : unavailable ? "Efeito já preparado" : "Pronto para usar"}
                            </small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="deck-item-grid">
                  {BAG_ITEM_CATALOG.map((item) => { const activeStatus = getStatusDefinition(active.status); const contextualDescription = item.effectType === "BAG_CURE" && activeStatus ? `Remove ${activeStatus.eventName}` : item.shortDescription; return <button
                    type="button"
                    key={item.id}
                    disabled={!myTurn || !bag[item.id]}
                    onClick={() => setSelectedItem(item.id)}
                    aria-label={`${item.name}. ${bag[item.id] ? `${bag[item.id]} disponíveis` : "Esgotado"}`}
                  >
                    <ItemSprite item={item.id} alt={item.name} />
                    <span><strong>{item.name}</strong><small>{bag[item.id] ? contextualDescription : "ESGOTADO"}</small></span>
                    <b>×{bag[item.id] || 0}</b>
                  </button>; })}
                </div>
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
                    <img src={getReserveSprite(pokemon)} alt="" />
                    <span>
                      <strong>{pokemon.name}</strong>
                      <small>
                        {activeSlot
                          ? "Ativo"
                          : fainted
                            ? "Desmaiado"
                            : `${pokemon.hp}/${pokemon.maxHp} HP`}
                      </small>
                      {pokemon.status && <small className={`switch-status is-${pokemon.status.id}`}><StatusIcon status={pokemon.status.id} size={12} /> {getStatusLabel(pokemon.status.id)}</small>}
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
        {state.status === "finished" && (badgeContext ? <BadgeBattleResultModal won={state.winner === role} badgeContext={badgeContext} onRematch={onRematch} /> : (
          <BattleResultModal
            won={state.winner === role}
            reward={victoryReward}
            coins={coins}
            mode={mode}
            onRematch={onRematch}
            tournamentContext={tournamentContext}
          />
        ))}
      </AnimatePresence>
    </>
  );
}
