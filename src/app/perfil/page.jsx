"use client";

import {
  ArrowLeft,
  Books,
  Check,
  Coins,
  Crown,
  GameController,
  Medal,
  PencilSimple,
  ShieldCheck,
  Sparkle,
  Sword,
  Trophy,
  Warning,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import BadgeArtwork from "@/components/Badges/BadgeArtwork";
import useTrainerProfile from "@/hooks/useTrainerProfile";
import { BADGE_CONFIG } from "@/lib/badges/config";
import { formatCoins } from "@/lib/economy";
import "./style.scss";

const modeLabels = {
  cpu: "CPU",
  pvp: "PvP",
  tournament: "Torneio",
  badge: "Insígnias",
};

function Stat({ label, value, Icon }) {
  return (
    <article>
      <Icon size={20} weight="fill" aria-hidden="true" />
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function Skeleton({ className = "" }) {
  return (
    <span
      className={`trainer-profile-skeleton ${className}`}
      aria-hidden="true"
    />
  );
}

function formatActivity(value) {
  if (!value) return "Nenhuma batalha válida registrada.";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TrainerProfilePage() {
  const {
    local,
    competitive,
    localLoading,
    competitiveLoading,
    competitiveError,
    savingName,
    retryCompetitive,
    saveName,
  } = useTrainerProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [saved, setSaved] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (local?.identity?.displayName && !editing)
      setName(local.identity.displayName);
  }, [editing, local?.identity?.displayName]);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function submitName(event) {
    event.preventDefault();
    setNameError("");
    try {
      await saveName(name);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setNameError(error.message);
    }
  }

  const progression = local?.progression;
  const collection = local?.collection;
  const battles = local?.battles;
  const currentBadges = competitive?.currentCount;
  const challenge = competitive?.activeChallenge;

  return (
    <main className="trainer-profile-page" id="main-content">
      <a className="trainer-profile-skip" href="#trainer-journey">
        Ir para sua jornada
      </a>
      <div className="trainer-profile-shell">
        <header className="trainer-profile-topbar">
          <Link href="/">
            <ArrowLeft size={20} aria-hidden="true" /> Início
          </Link>
          <span>PERFIL DO TREINADOR</span>
        </header>

        <section className="trainer-card" aria-labelledby="trainer-name">
          <div className="trainer-card__shine" aria-hidden="true" />
          <div className="trainer-card__art" aria-hidden="true">
            <span>POKÉDEXPLORE</span>
            <img src="/pokemons/pk-trainer-man.png" alt="" />
          </div>
          <div className="trainer-card__content">
            <span className="trainer-eyebrow">CARTÃO DE TREINADOR</span>
            {localLoading ? (
              <>
                <Skeleton className="is-name" />
                <Skeleton className="is-line" />
              </>
            ) : (
              <>
                <div className="trainer-card__identity">
                  <div>
                    <h1 id="trainer-name">{local.identity.displayName}</h1>
                    <p>Treinador Nv. {progression.level}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(true);
                      setNameError("");
                    }}
                    aria-label="Editar nome do treinador"
                  >
                    <PencilSimple size={20} aria-hidden="true" />
                  </button>
                </div>
                <span className="trainer-card__id">ID {local.trainerId}</span>
              </>
            )}
            {editing && (
              <form className="trainer-name-form" onSubmit={submitName}>
                <label htmlFor="trainer-display-name">Nome do treinador</label>
                <input
                  ref={inputRef}
                  id="trainer-display-name"
                  value={name}
                  onChange={(event) => setName(event.target.value.slice(0, 18))}
                  maxLength={18}
                  autoComplete="nickname"
                  aria-describedby={
                    nameError ? "trainer-name-error" : "trainer-name-help"
                  }
                />
                <small id="trainer-name-help">Até 18 caracteres.</small>
                {nameError && (
                  <p id="trainer-name-error" role="alert">
                    {nameError}
                  </p>
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(false);
                      setName(local.identity.displayName);
                    }}
                    disabled={savingName}
                  >
                    <X size={18} aria-hidden="true" /> Cancelar
                  </button>
                  <button type="submit" disabled={savingName}>
                    <Check size={18} aria-hidden="true" />{" "}
                    {savingName ? "Salvando..." : "Salvar"}
                  </button>
                </div>
              </form>
            )}
            {saved && (
              <p className="trainer-card__saved" role="status">
                <Check size={17} weight="bold" aria-hidden="true" /> Nome salvo.
              </p>
            )}
            <div className="trainer-card__progress">
              <div>
                <strong>
                  {localLoading ? "NV. —" : `NV. ${progression.level}`}
                </strong>
                <span>
                  {localLoading
                    ? "Carregando experiência"
                    : `${progression.currentXp} / ${progression.nextLevelXp} XP`}
                </span>
              </div>
              <span
                className="trainer-xp-track"
                role="progressbar"
                aria-label="Experiência do treinador"
                aria-valuemin="0"
                aria-valuemax={progression?.nextLevelXp || 100}
                aria-valuenow={progression?.currentXp || 0}
              >
                <i style={{ width: `${progression?.percent || 0}%` }} />
              </span>
            </div>
            <div className="trainer-card__mini-stats">
              <span>
                <Coins weight="fill" aria-hidden="true" />{" "}
                {localLoading ? "—" : formatCoins(local.coins)} moedas
              </span>
              <span>
                <GameController weight="fill" aria-hidden="true" />{" "}
                {localLoading ? "—" : collection.total} Pokémon
              </span>
              <span>
                <Medal weight="fill" aria-hidden="true" />{" "}
                {competitiveLoading
                  ? "—"
                  : competitive
                    ? currentBadges
                    : "Indisponível"}{" "}
                Insígnias atuais
              </span>
            </div>
          </div>
        </section>

        <section
          className="trainer-quick-stats"
          aria-label="Resumo do treinador"
        >
          {localLoading ? (
            Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="is-stat" />
            ))
          ) : (
            <>
              <Stat
                Icon={GameController}
                value={collection.total}
                label="Pokémon"
              />
              <Stat Icon={Trophy} value={battles.wins} label="Vitórias" />
              <Stat
                Icon={Medal}
                value={
                  competitiveLoading
                    ? "—"
                    : competitive
                      ? competitive.currentCount
                      : "—"
                }
                label="Insígnias atuais"
              />
              <Stat Icon={Books} value={local.decks.length} label="Decks" />
            </>
          )}
        </section>

        <div className="trainer-profile-columns">
          <section
            className="trainer-section trainer-journey"
            id="trainer-journey"
            aria-labelledby="journey-title"
          >
            <div className="trainer-section__heading">
              <div>
                <span className="trainer-eyebrow">SUA JORNADA</span>
                <h2 id="journey-title">Coleção Pokémon</h2>
              </div>
              <Link href="/pokedex">Ver Pokédex</Link>
            </div>
            {localLoading ? (
              <div className="trainer-section-loading">
                <Skeleton />
                <Skeleton />
              </div>
            ) : collection.total ? (
              <>
                <p className="trainer-journey__lead">
                  <strong>{collection.total}</strong> Pokémon capturados
                </p>
                <div className="trainer-journey__stats">
                  <span>
                    <b>{collection.legendary}</b> Lendários
                  </span>
                  <span>
                    <b>{collection.mythical}</b> Míticos
                  </span>
                  <span>
                    <b>{collection.maxLevel}</b> no Nv. 10
                  </span>
                  <span>
                    <b>{collection.highestLevel}</b> maior nível
                  </span>
                </div>
              </>
            ) : (
              <div className="trainer-empty">
                <GameController size={30} weight="fill" aria-hidden="true" />
                <div>
                  <strong>Sua jornada está começando.</strong>
                  <p>
                    Capture seu primeiro Pokémon para construir sua coleção.
                  </p>
                </div>
                <Link href="/pokedex">Explorar Pokédex</Link>
              </div>
            )}
          </section>

          <section
            className="trainer-section trainer-battles"
            aria-labelledby="battles-title"
          >
            <div className="trainer-section__heading">
              <div>
                <span className="trainer-eyebrow">HISTÓRICO LOCAL</span>
                <h2 id="battles-title">Batalhas</h2>
              </div>
            </div>
            {localLoading ? (
              <div className="trainer-section-loading">
                <Skeleton />
                <Skeleton />
              </div>
            ) : (
              <>
                <div className="trainer-battle-total">
                  <span>
                    <strong>{battles.wins}</strong> vitórias
                  </span>
                  <span>
                    <strong>{battles.losses}</strong> derrotas
                  </span>
                  <span>
                    <strong>{battles.winRate}%</strong> aproveitamento
                  </span>
                </div>
                {battles.battlesCompleted ? (
                  <div className="trainer-battle-modes">
                    {Object.entries(battles.byMode).map(([mode, stats]) => (
                      <span key={mode}>
                        <b>{modeLabels[mode]}</b>
                        <small>
                          {stats.wins} V · {stats.losses} D
                        </small>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="trainer-muted">
                    Conclua uma batalha para iniciar seu histórico.
                  </p>
                )}
                {battles.includesLegacyAggregate && (
                  <small className="trainer-note">
                    Resultados anteriores preservados no total; a divisão por
                    modo começa com os novos registros.
                  </small>
                )}
              </>
            )}
          </section>
        </div>

        <section
          className="trainer-section trainer-badges"
          aria-labelledby="badges-title"
        >
          <div className="trainer-section__heading">
            <div>
              <span className="trainer-eyebrow">LEGADO COMPETITIVO</span>
              <h2 id="badges-title">Suas Insígnias</h2>
            </div>
            <Link href="/jornada/insignias">Ver arena de Insígnias</Link>
          </div>
          {competitiveLoading && (
            <div
              className="trainer-badge-loading"
              aria-label="Carregando Insígnias"
            >
              {BADGE_CONFIG.map((badge) => (
                <Skeleton key={badge.code} className="is-badge" />
              ))}
            </div>
          )}
          {!competitiveLoading && competitiveError && !competitive && (
            <div className="trainer-remote-error" role="alert">
              <Warning size={27} weight="fill" aria-hidden="true" />
              <div>
                <strong>
                  Não foi possível carregar as informações competitivas.
                </strong>
                <p>Seu perfil local e sua coleção continuam disponíveis.</p>
              </div>
              <button type="button" onClick={retryCompetitive}>
                Tentar novamente
              </button>
            </div>
          )}
          {!competitiveLoading && competitive && (
            <>
              {competitiveError && (
                <p className="trainer-sync-warning" role="status">
                  {competitiveError}
                </p>
              )}
              <div className="trainer-badge-counters">
                <span>
                  <b>
                    {competitive.currentCount} / {BADGE_CONFIG.length}
                  </b>{" "}
                  Atuais
                </span>
                <span>
                  <b>
                    {competitive.conqueredCount} / {BADGE_CONFIG.length}
                  </b>{" "}
                  Conquistadas
                </span>
                <span>
                  <b>{competitive.remainingCount}</b> Restantes
                </span>
              </div>
              <div className="trainer-badge-grid">
                {competitive.slots.map((slot) => (
                  <Link
                    key={slot.config.code}
                    href={`/jornada/insignias?badge=${slot.config.code}`}
                    className={`trainer-badge-slot is-${slot.state}`}
                    style={{ "--badge-color": slot.config.color }}
                    aria-label={`${slot.config.name} — ${slot.current ? "Campeão atual" : slot.conquered ? "Conquistada anteriormente" : "Ainda não conquistada"}`}
                  >
                    <BadgeArtwork badge={slot.config} decorative />
                    <span>
                      {slot.current ? (
                        <>
                          <Crown weight="fill" aria-hidden="true" /> Atual
                        </>
                      ) : slot.conquered ? (
                        <>
                          <Check weight="bold" aria-hidden="true" /> Conquistada
                        </>
                      ) : (
                        "Não conquistada"
                      )}
                    </span>
                  </Link>
                ))}
              </div>
              {!competitive.conqueredCount && (
                <p className="trainer-badges-empty">
                  Conquiste Insígnias na Jornada e construa seu legado.
                </p>
              )}
            </>
          )}
        </section>

        <div className="trainer-profile-columns">
          <section
            className="trainer-section trainer-competitive"
            aria-labelledby="competitive-title"
          >
            <div className="trainer-section__heading">
              <div>
                <span className="trainer-eyebrow">ARENA</span>
                <h2 id="competitive-title">Status competitivo</h2>
              </div>
            </div>
            {competitiveLoading ? (
              <div className="trainer-section-loading">
                <Skeleton />
                <Skeleton />
              </div>
            ) : competitive ? (
              <>
                <div className="trainer-competitive__stats">
                  <span>
                    <Crown weight="fill" aria-hidden="true" />
                    <b>{competitive.currentCount}</b> atuais
                  </span>
                  <span>
                    <ShieldCheck weight="fill" aria-hidden="true" />
                    <b>{competitive.lifetimeDefenseCount}</b> defesas históricas
                  </span>
                </div>
                {competitive.currentCount > 0 && (
                  <div className="trainer-champion-benefit">
                    <Coins weight="fill" aria-hidden="true" />
                    <div>
                      <strong>Benefício de campeão ativo</strong>
                      <p>+25% de moedas em batalhas CPU e PvP elegíveis.</p>
                      <small>
                        Última batalha válida:{" "}
                        {formatActivity(competitive.lastBattleAt)}
                      </small>
                    </div>
                  </div>
                )}
                {challenge && (
                  <div className="trainer-active-challenge">
                    <Sword weight="fill" aria-hidden="true" />
                    <div>
                      <strong>Desafio em andamento</strong>
                      <p>
                        {challenge.badge?.config?.name || "Insígnia"} ·{" "}
                        {challenge.challenger_wins}/{challenge.wins_required}{" "}
                        vitórias
                      </p>
                    </div>
                    <Link href={`/batalha?badgeChallenge=${challenge.id}`}>
                      Continuar
                    </Link>
                  </div>
                )}
                {!competitive.currentCount && !challenge && (
                  <p className="trainer-muted">
                    Nenhuma Insígnia atual ou desafio em andamento.
                  </p>
                )}
              </>
            ) : (
              <p className="trainer-muted">Status competitivo indisponível.</p>
            )}
          </section>

          <section
            className="trainer-section trainer-decks"
            aria-labelledby="decks-title"
          >
            <div className="trainer-section__heading">
              <div>
                <span className="trainer-eyebrow">EQUIPES</span>
                <h2 id="decks-title">Decks</h2>
              </div>
            </div>
            {localLoading ? (
              <div className="trainer-section-loading">
                <Skeleton />
                <Skeleton />
              </div>
            ) : (
              <>
                <div className="trainer-decks__count">
                  <Books size={31} weight="fill" aria-hidden="true" />
                  <strong>{local.decks.length}</strong>
                  <span>
                    {local.decks.length === 1 ? "deck salvo" : "decks salvos"}
                  </span>
                </div>
                <p>
                  {local.decks.length
                    ? "Suas equipes estão prontas para seleção antes da batalha."
                    : "Monte uma equipe com 3 Pokémon antes da próxima batalha."}
                </p>
                <Link href="/batalha">Ir para batalha</Link>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
