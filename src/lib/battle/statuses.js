export const SUPPORTED_STATUS_IDS = Object.freeze([
  "paralysis",
  "sleep",
  "burn",
  "poison",
]);

export const STATUS_DEFINITIONS = Object.freeze({
  paralysis: Object.freeze({
    id: "paralysis",
    displayName: "Paralisado",
    eventName: "Paralisia",
    icon: "lightning",
    shortDescription: "Pode impedir o Pokémon de agir.",
    battleDescription: "A cada ação, a paralisia pode impedir este Pokémon de se mover.",
    strategicHint: "Você pode arriscar o golpe, trocar de Pokémon ou remover a condição.",
    curable: true,
    supportedCures: Object.freeze(["purifier", "purifying-elixir"]),
  }),
  sleep: Object.freeze({
    id: "sleep",
    displayName: "Dormindo",
    eventName: "Sono",
    icon: "moon",
    shortDescription: "Não consegue atacar enquanto dorme.",
    battleDescription: "O Pokémon perde ações enquanto dorme e acorda quando a duração termina.",
    strategicHint: "Troque de Pokémon ou use um item que remova a condição.",
    curable: true,
    supportedCures: Object.freeze(["purifier", "purifying-elixir"]),
  }),
  burn: Object.freeze({
    id: "burn",
    displayName: "Queimado",
    eventName: "Queimadura",
    icon: "fire",
    shortDescription: "Perde 8% do HP máximo ao fim de sua ação.",
    battleDescription: "A queimadura causa dano periódico. Ela não reduz o Ataque no PokédExplore.",
    strategicHint: "Remova a condição antes que o dano acumulado se torne decisivo.",
    curable: true,
    supportedCures: Object.freeze(["purifier", "purifying-elixir"]),
  }),
  poison: Object.freeze({
    id: "poison",
    displayName: "Envenenado",
    eventName: "Veneno",
    icon: "skull",
    shortDescription: "Perde 8% do HP máximo ao fim de sua ação.",
    battleDescription: "O veneno causa dano periódico sempre que este Pokémon conclui uma ação.",
    strategicHint: "Cure, troque ou encerre a luta antes que o dano periódico se acumule.",
    curable: true,
    supportedCures: Object.freeze(["purifier", "purifying-elixir"]),
  }),
});

export function getStatusDefinition(status) {
  const id = typeof status === "string" ? status : status?.id;
  return STATUS_DEFINITIONS[id] || null;
}

export function isSupportedStatus(status) {
  return Boolean(getStatusDefinition(status));
}

export function normalizeStatusEffect(move = {}) {
  const rawStatus = move.statusEffect?.status || move.statusEffect?.id || move.meta?.ailment?.name;
  if (!isSupportedStatus(rawStatus)) return null;
  const rawChance = move.statusEffect?.chance ?? move.meta?.ailment_chance ?? move.effect_chance;
  const numericChance = Number(rawChance);
  const chance = Number.isFinite(numericChance)
    ? Math.max(0, Math.min(1, numericChance > 1 ? numericChance / 100 : numericChance))
    : 0;
  if (chance <= 0) return null;
  return Object.freeze({ id: rawStatus, chance });
}
