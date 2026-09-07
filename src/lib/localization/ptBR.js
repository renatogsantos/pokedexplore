// Player-facing PT-BR vocabulary. Internal PokéAPI ids and battle protocol values stay untouched.
export const TYPE_LABELS = Object.freeze({ normal: "Normal", fire: "Fogo", water: "Água", electric: "Elétrico", grass: "Planta", ice: "Gelo", fighting: "Lutador", poison: "Veneno", ground: "Terrestre", flying: "Voador", psychic: "Psíquico", bug: "Inseto", rock: "Pedra", ghost: "Fantasma", dragon: "Dragão", dark: "Sombrio", steel: "Aço", fairy: "Fada" });
export const STATUS_LABELS = Object.freeze({ burn: "Queimado", poison: "Envenenado", paralysis: "Paralisado", sleep: "Dormindo", fainted: "Desmaiado" });
export const ITEM_LABELS = Object.freeze({ potion: "Poção", "full-heal": "Cura Total", oran: "Berry Oran", sitrus: "Berry Sitrus", "type-boost": "Amplificador de tipo" });
export const getTypeLabel = (type) => TYPE_LABELS[type] || type;
export const getStatusLabel = (status) => STATUS_LABELS[status] || status;
export const getItemLabel = (item) => ITEM_LABELS[item] || item;
