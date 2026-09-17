import { getPokemonRarity, POKEMON_RARITY } from "@/lib/pokemon/rarity";
import {
  BADGE_CHAMPION_COIN_MULTIPLIER,
  BADGE_INACTIVITY_HOURS,
  BADGE_REQUIRED_WINS,
  BADGE_TEAM_SIZE,
} from "./config";

export const BADGE_SERIES_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  ACQUIRED: "ACQUIRED",
  DEFENDED: "DEFENDED",
});

function normalizedTypes(pokemon) {
  if (Array.isArray(pokemon?.types)) {
    return pokemon.types
      .map((entry) => typeof entry === "string" ? entry : entry?.type?.name || entry?.name)
      .filter(Boolean)
      .map((type) => String(type).toLowerCase());
  }
  return pokemon?.type ? [String(pokemon.type).toLowerCase()] : [];
}

export function getBadgePokemonRestriction(pokemon) {
  const rarity = getPokemonRarity(pokemon);
  if (rarity === POKEMON_RARITY.LEGENDARY) return "legendary";
  if (rarity === POKEMON_RARITY.MYTHICAL) return "mythical";
  return null;
}

export function isPokemonEligibleForBadgeBattle(pokemon) {
  return Boolean(pokemon) && !getBadgePokemonRestriction(pokemon);
}

export function teamHasBadgeType(team, badgeType) {
  const expected = String(badgeType || "").toLowerCase();
  return Boolean(expected) && (team || []).some((pokemon) => normalizedTypes(pokemon).includes(expected));
}

export function validateBadgeTeam(team, badgeType) {
  const roster = Array.isArray(team) ? team : [];
  const legendary = roster.find((pokemon) => getBadgePokemonRestriction(pokemon) === "legendary");
  const mythical = roster.find((pokemon) => getBadgePokemonRestriction(pokemon) === "mythical");
  const errors = [];
  if (roster.length !== BADGE_TEAM_SIZE) errors.push({ code: "team-size", message: `Escolha exatamente ${BADGE_TEAM_SIZE} Pokémon.` });
  if (legendary) errors.push({ code: "legendary", pokemon: legendary, message: `${legendary.displayName || legendary.name} é Lendário e não pode participar.` });
  if (mythical) errors.push({ code: "mythical", pokemon: mythical, message: `${mythical.displayName || mythical.name} é Mítico e não pode participar.` });
  if (!teamHasBadgeType(roster, badgeType)) errors.push({ code: "missing-type", message: "A equipe precisa de pelo menos 1 Pokémon do tipo da Insígnia." });
  return {
    valid: errors.length === 0,
    errors,
    hasRequiredType: teamHasBadgeType(roster, badgeType),
    hasLegendary: Boolean(legendary),
    hasMythical: Boolean(mythical),
  };
}

export function advanceBadgeSeries({ challengerWins = 0, challengerWon, winsRequired = BADGE_REQUIRED_WINS }) {
  if (!challengerWon) return { status: BADGE_SERIES_STATUS.DEFENDED, challengerWins, complete: true };
  const nextWins = Math.min(winsRequired, challengerWins + 1);
  return {
    status: nextWins >= winsRequired ? BADGE_SERIES_STATUS.ACQUIRED : BADGE_SERIES_STATUS.ACTIVE,
    challengerWins: nextWins,
    complete: nextWins >= winsRequired,
  };
}

export function isBadgeOwnerInactive({ lastBattleAt, now, activeChallenge = false, inactivityHours = BADGE_INACTIVITY_HOURS }) {
  if (activeChallenge || !lastBattleAt) return false;
  const elapsed = new Date(now).getTime() - new Date(lastBattleAt).getTime();
  return Number.isFinite(elapsed) && elapsed >= inactivityHours * 60 * 60 * 1000;
}

export function getChampionCoinMultiplier(badgeCount) {
  return Number(badgeCount) > 0 ? BADGE_CHAMPION_COIN_MULTIPLIER : 1;
}

export function getBadgeTeamErrorMessage(validation, localizedTypeName) {
  const error = validation?.errors?.[0];
  if (!error) return "";
  if (error.code === "missing-type") return `Escolha pelo menos 1 Pokémon do tipo ${localizedTypeName}.`;
  return error.message;
}
