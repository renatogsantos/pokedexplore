import { getTypeLabel } from "@/lib/localization/ptBR";

export const BADGE_REQUIRED_WINS = 4;
export const BADGE_TEAM_SIZE = 3;
export const BADGE_INACTIVITY_HOURS = 48;
export const BADGE_CHALLENGE_DURATION_HOURS = 48;
export const BADGE_CHAMPION_COIN_MULTIPLIER = 1.25;

const BADGE_NAMES = Object.freeze({
  normal: "Insígnia do Equilíbrio",
  fire: "Insígnia da Chama",
  water: "Insígnia da Maré",
  electric: "Insígnia do Trovão",
  grass: "Insígnia da Floresta",
  ice: "Insígnia Glacial",
  fighting: "Insígnia do Combate",
  poison: "Insígnia Tóxica",
  ground: "Insígnia da Terra",
  flying: "Insígnia dos Céus",
  psychic: "Insígnia Psíquica",
  bug: "Insígnia do Enxame",
  rock: "Insígnia da Rocha",
  ghost: "Insígnia Espectral",
  dragon: "Insígnia do Dragão",
  dark: "Insígnia Sombria",
  steel: "Insígnia de Aço",
  fairy: "Insígnia Encantada",
});

const BADGE_COLORS = Object.freeze({
  normal: "#d8c5a5",
  fire: "#ff6b3d",
  water: "#4aa8ff",
  electric: "#ffd84a",
  grass: "#70d66b",
  ice: "#9ce9f4",
  fighting: "#ef646b",
  poison: "#bc75e6",
  ground: "#d9a95d",
  flying: "#90b8ff",
  psychic: "#ef73ad",
  bug: "#a8cb4a",
  rock: "#c2a267",
  ghost: "#8576c9",
  dragon: "#8170ff",
  dark: "#817b8c",
  steel: "#b9c7d5",
  fairy: "#f3a8d2",
});

export const BADGE_TYPES = Object.freeze(Object.keys(BADGE_NAMES));

export const BADGE_CONFIG = Object.freeze(
  BADGE_TYPES.map((type, index) => Object.freeze({
    id: index + 1,
    code: type,
    type,
    name: BADGE_NAMES[type],
    localizedTypeName: getTypeLabel(type),
    artworkImage: `/badges/badge-${type}.png`,
    image: `/badges/badge-${type}.png`,
    fallbackImage: `/icons/${type}.svg`,
    color: BADGE_COLORS[type],
    leaderName: `Líder ${getTypeLabel(type)}`,
  })),
);

export const BADGE_CONFIG_BY_CODE = Object.freeze(
  Object.fromEntries(BADGE_CONFIG.map((badge) => [badge.code, badge])),
);

export function getBadgeConfig(codeOrType) {
  return BADGE_CONFIG_BY_CODE[String(codeOrType || "").toLowerCase()] || null;
}
