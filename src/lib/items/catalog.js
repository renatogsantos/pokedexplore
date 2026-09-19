export const ITEM_SYSTEM_VERSION = 2;

export const ITEM_RARITY = Object.freeze({
  COMMON: "COMMON",
  RARE: "RARE",
  EPIC: "EPIC",
  LEGENDARY: "LEGENDARY",
});
export const ITEM_USAGE = Object.freeze({ HELD: "HELD", BAG: "BAG" });
export const ITEM_CATEGORY = Object.freeze({
  FRUIT: "FRUIT",
  POTION: "POTION",
  CRYSTAL: "CRYSTAL",
  AMULET: "AMULET",
  CORE: "CORE",
  ARTIFACT: "ARTIFACT",
  DEFENSE: "DEFENSE",
  OFFENSE: "OFFENSE",
  TACTICAL: "TACTICAL",
});

export const RARITY_LABELS = Object.freeze({
  COMMON: "COMUM",
  RARE: "RARO",
  EPIC: "ÉPICO",
  LEGENDARY: "LENDÁRIO",
});
export const USAGE_LABELS = Object.freeze({
  HELD: "ITEM EQUIPADO",
  BAG: "MOCHILA",
});
export const ROLE_LABELS = Object.freeze({
  healing: "CURA",
  defense: "DEFESA",
  attack: "ATAQUE",
  tactical: "TÁTICO",
  status: "STATUS",
  survival: "SOBREVIVÊNCIA",
  special: "ESPECIAL",
});

const item = (definition) =>
  Object.freeze({
    code: definition.id.toUpperCase().replaceAll("-", "_"),
    image: `/items/${definition.id}.png`,
    purchasable: true,
    ...definition,
    rules: Object.freeze(definition.rules || {}),
  });

// Authoritative PokédExplore item catalog. Economy, UI and battle handlers use
// these values; tune initial balance here without changing components.
export const ITEM_CATALOG = Object.freeze([
  item({
    id: "fruit-vital",
    name: "Fruto Vital",
    category: "FRUIT",
    usageType: "HELD",
    rarity: "COMMON",
    role: "healing",
    shortDescription: "Cura automática • 20%",
    description:
      "Quando fica com 50% de HP ou menos após receber dano, recupera 20% da vida máxima.",
    effectType: "HEAL_PERCENT",
    trigger: "AFTER_DAMAGE",
    consumable: true,
    price: 45,
    rules: { hpRatioLTE: 0.5, healPercent: 0.2 },
  }),
  item({
    id: "healing-core",
    name: "Núcleo de Cura",
    category: "CORE",
    usageType: "HELD",
    rarity: "RARE",
    role: "healing",
    shortDescription: "Cura crítica • 50%",
    description:
      "Quando fica com 25% de HP ou menos após receber dano, recupera 50% da vida máxima.",
    effectType: "HEAL_PERCENT",
    trigger: "AFTER_DAMAGE",
    consumable: true,
    price: 120,
    rules: { hpRatioLTE: 0.25, healPercent: 0.5 },
  }),
  item({
    id: "regeneration-leaf",
    name: "Folha Regeneradora",
    category: "FRUIT",
    usageType: "HELD",
    rarity: "RARE",
    role: "healing",
    shortDescription: "Regenera 10% por 4 turnos",
    description:
      "Ao cair para 50% de HP ou menos após receber dano, regenera 10% da vida máxima por 4 turnos.",
    effectType: "REGENERATION",
    trigger: "AFTER_DAMAGE",
    consumable: true,
    price: 135,
    rules: { hpRatioLTE: 0.5, healPercent: 0.1, ticks: 4 },
  }),
  item({
    id: "survival-amulet",
    name: "Amuleto de Sobrevivência",
    category: "AMULET",
    usageType: "HELD",
    rarity: "EPIC",
    role: "survival",
    shortDescription: "Sobrevive com 1 HP",
    description:
      "Impede uma derrota por dano e mantém o portador com exatamente 1 HP.",
    effectType: "SURVIVE",
    trigger: "BEFORE_LETHAL_DAMAGE",
    consumable: true,
    price: 300,
  }),
  item({
    id: "guardian-plate",
    name: "Placa Guardiã",
    category: "DEFENSE",
    usageType: "HELD",
    rarity: "COMMON",
    role: "defense",
    shortDescription: "Primeiro dano −25%",
    description: "Reduz em 25% o primeiro ataque que causar dano ao portador.",
    effectType: "INCOMING_DAMAGE",
    trigger: "DAMAGE_CALCULATION",
    consumable: true,
    price: 60,
    rules: { multiplier: 0.75 },
  }),
  item({
    id: "resistance-crystal",
    name: "Cristal Resistente",
    category: "CRYSTAL",
    usageType: "HELD",
    rarity: "RARE",
    role: "defense",
    shortDescription: "Super efetivo −25%",
    description: "Ataques super efetivos causam 25% menos dano.",
    effectType: "INCOMING_DAMAGE",
    trigger: "DAMAGE_CALCULATION",
    consumable: false,
    price: 150,
    rules: { multiplier: 0.75, superEffectiveOnly: true },
  }),
  item({
    id: "arcane-mirror",
    name: "Espelho Arcano",
    category: "AMULET",
    usageType: "HELD",
    rarity: "EPIC",
    role: "status",
    shortDescription: "Bloqueia um efeito negativo",
    description:
      "Impede o primeiro estado negativo que seria aplicado ao portador.",
    effectType: "PREVENT_STATUS",
    trigger: "BEFORE_STATUS",
    consumable: true,
    price: 270,
  }),
  item({
    id: "purifier",
    name: "Purificador",
    category: "AMULET",
    usageType: "HELD",
    rarity: "RARE",
    role: "status",
    shortDescription: "Remove o primeiro estado • cura 25%",
    description:
      "Remove automaticamente o primeiro estado negativo aplicado ao portador e recupera 25% da vida máxima.",
    effectType: "CURE_STATUS",
    trigger: "AFTER_STATUS",
    consumable: true,
    price: 135,
    rules: { healPercent: 0.25 },
  }),
  item({
    id: "power-claw",
    name: "Garra de Poder",
    category: "OFFENSE",
    usageType: "HELD",
    rarity: "RARE",
    role: "attack",
    shortDescription: "+20% dano • recebe +8%",
    description: "Causa 20% mais dano, mas também recebe 8% mais dano.",
    effectType: "DAMAGE_TRADEOFF",
    trigger: "DAMAGE_CALCULATION",
    consumable: false,
    price: 150,
    rules: { dealtMultiplier: 1.2, receivedMultiplier: 1.08 },
  }),
  item({
    id: "elemental-core",
    name: "Núcleo Elemental",
    category: "CORE",
    usageType: "HELD",
    rarity: "RARE",
    role: "attack",
    shortDescription: "Golpe primário +22%",
    description: "Golpes do tipo primário do portador causam 22% mais dano.",
    effectType: "TYPE_DAMAGE",
    trigger: "DAMAGE_CALCULATION",
    consumable: false,
    price: 165,
    rules: { multiplier: 1.22 },
  }),
  item({
    id: "impact-crystal",
    name: "Cristal de Impacto",
    category: "CRYSTAL",
    usageType: "HELD",
    rarity: "COMMON",
    role: "attack",
    shortDescription: "Primeiro ataque +20%",
    description:
      "O primeiro ataque bem-sucedido do portador causa 20% mais dano.",
    effectType: "NEXT_ATTACK",
    trigger: "DAMAGE_CALCULATION",
    consumable: true,
    price: 75,
    rules: { multiplier: 1.2 },
  }),
  item({
    id: "unstable-charge",
    name: "Carga Instável",
    category: "CORE",
    usageType: "HELD",
    rarity: "EPIC",
    role: "attack",
    shortDescription: "Com HP baixo, dano +15%",
    description:
      "Enquanto estiver com 40% de HP ou menos, causa 15% mais dano.",
    effectType: "LOW_HP_DAMAGE",
    trigger: "DAMAGE_CALCULATION",
    consumable: false,
    price: 300,
    rules: { hpRatioLTE: 0.4, multiplier: 1.15 },
  }),
  item({
    id: "impulse-boots",
    name: "Botas de Impulso",
    category: "TACTICAL",
    usageType: "HELD",
    rarity: "RARE",
    role: "tactical",
    shortDescription: "Após troca, próximo ataque +30%",
    description:
      "Depois de entrar por uma troca, o próximo ataque bem-sucedido causa 30% mais dano.",
    effectType: "SWITCH_ATTACK",
    trigger: "AFTER_SWITCH_IN",
    consumable: false,
    price: 135,
    rules: { multiplier: 1.3 },
  }),
  item({
    id: "return-symbol",
    name: "Símbolo de Retorno",
    category: "TACTICAL",
    usageType: "HELD",
    rarity: "EPIC",
    role: "tactical",
    shortDescription: "Ao trocar, recupera 10%",
    description:
      "Ao ser retirado voluntariamente com vida, recupera 10% da vida máxima.",
    effectType: "SWITCH_HEAL",
    trigger: "BEFORE_SWITCH_OUT",
    consumable: true,
    price: 270,
    rules: { healPercent: 0.1 },
  }),
  item({
    id: "strategist-eye",
    name: "Olho do Estrategista",
    category: "TACTICAL",
    usageType: "HELD",
    rarity: "RARE",
    role: "tactical",
    shortDescription: "Revela efetividade • super efetivo +15%",
    description:
      "Mostra a efetividade dos golpes do portador contra o oponente atual e faz golpes super efetivos causarem 15% mais dano.",
    effectType: "BATTLE_INFO",
    trigger: "PASSIVE",
    consumable: false,
    price: 120,
    rules: { superEffectiveMultiplier: 1.15 },
  }),
  item({
    id: "poison-thorn",
    name: "Espinho Venenoso",
    category: "TACTICAL",
    usageType: "HELD",
    rarity: "EPIC",
    role: "status",
    shortDescription: "20% de envenenar o atacante",
    description:
      "Ao receber dano direto, tem 20% de chance de envenenar o atacante.",
    effectType: "RETALIATE_POISON",
    trigger: "AFTER_DAMAGE",
    consumable: false,
    price: 300,
    rules: { chance: 0.2 },
  }),
  item({
    id: "vampiric-crystal",
    name: "Cristal Vampírico",
    category: "CRYSTAL",
    usageType: "HELD",
    rarity: "EPIC",
    role: "healing",
    shortDescription: "Recupera 5% do dano causado",
    description:
      "Após causar dano direto, recupera 5% do dano realmente causado.",
    effectType: "DRAIN_DAMAGE",
    trigger: "AFTER_DAMAGE_DEALT",
    consumable: false,
    price: 330,
    rules: { damageHealPercent: 0.05 },
  }),
  item({
    id: "special-fragment",
    name: "Fragmento Especial",
    category: "ARTIFACT",
    usageType: "HELD",
    rarity: "EPIC",
    role: "special",
    shortDescription: "Primeiro Especial +15%",
    description: "O primeiro golpe Especial bem-sucedido causa 15% mais dano.",
    effectType: "SPECIAL_DAMAGE",
    trigger: "DAMAGE_CALCULATION",
    consumable: true,
    price: 270,
    rules: { multiplier: 1.15 },
  }),
  item({
    id: "vital-potion",
    name: "Poção Vital",
    category: "POTION",
    usageType: "BAG",
    rarity: "COMMON",
    role: "healing",
    shortDescription: "Recupera 40% do HP",
    description: "Recupera 40% da vida máxima de um Pokémon com vida.",
    effectType: "BAG_HEAL",
    trigger: "MANUAL",
    consumable: true,
    price: 45,
    rules: { healPercent: 0.4 },
  }),
  item({
    id: "supreme-potion",
    name: "Poção Suprema",
    category: "POTION",
    usageType: "BAG",
    rarity: "EPIC",
    role: "healing",
    shortDescription: "Recupera 60% do HP",
    description: "Recupera 60% da vida máxima de um Pokémon com vida.",
    effectType: "BAG_HEAL",
    trigger: "MANUAL",
    consumable: true,
    price: 270,
    rules: { healPercent: 0.6 },
  }),
  item({
    id: "purifying-elixir",
    name: "Elixir Purificador",
    category: "POTION",
    usageType: "BAG",
    rarity: "COMMON",
    role: "status",
    shortDescription: "Remove um estado negativo",
    description: "Remove o estado negativo atual de um Pokémon.",
    effectType: "BAG_CURE",
    trigger: "MANUAL",
    consumable: true,
    price: 60,
  }),
  item({
    id: "instant-barrier",
    name: "Barreira Instantânea",
    category: "TACTICAL",
    usageType: "BAG",
    rarity: "RARE",
    role: "defense",
    shortDescription: "Próximo dano −50%",
    description:
      "O próximo ataque recebido pelo Pokémon ativo causa 50% menos dano.",
    effectType: "BAG_BARRIER",
    trigger: "MANUAL",
    consumable: true,
    price: 120,
    rules: { multiplier: 0.5 },
  }),
  item({
    id: "stimulant",
    name: "Estimulante",
    category: "OFFENSE",
    usageType: "BAG",
    rarity: "RARE",
    role: "attack",
    shortDescription: "Próximo ataque +35%",
    description:
      "O próximo ataque bem-sucedido do Pokémon ativo causa 35% mais dano.",
    effectType: "BAG_STIMULANT",
    trigger: "MANUAL",
    consumable: true,
    price: 120,
    rules: { multiplier: 1.35 },
  }),
  item({
    id: "recharge-crystal",
    name: "Cristal de Recarga",
    category: "ARTIFACT",
    usageType: "BAG",
    rarity: "EPIC",
    role: "special",
    shortDescription: "Recupera 1 uso Especial",
    description:
      "Recupera um uso de golpe Especial, até o limite normal. Uma vez por Pokémon em cada batalha.",
    effectType: "BAG_RECHARGE",
    trigger: "MANUAL",
    consumable: true,
    price: 300,
    rules: { amount: 1, maxPerPokemon: 1 },
  }),
  item({
    id: "phoenix-heart",
    name: "Coração da Fênix",
    category: "ARTIFACT",
    usageType: "HELD",
    rarity: "LEGENDARY",
    role: "survival",
    shortDescription: "Sobrevive • 60% da vida • próximo ataque +25%",
    description:
      "Impede uma derrota por dano, recupera 60% da vida máxima e fortalece o próximo ataque em 25%.",
    effectType: "SURVIVE_AND_BUFF",
    trigger: "BEFORE_LETHAL_DAMAGE",
    consumable: true,
    price: 3800,
    rules: { healPercent: 0.6, multiplier: 1.25 },
  }),
  item({
    id: "challenger-crown",
    name: "Coroa do Desafiante",
    category: "ARTIFACT",
    usageType: "HELD",
    rarity: "LEGENDARY",
    role: "tactical",
    shortDescription: "Contra nível maior: +25%/−20%",
    description:
      "Contra um oponente de nível maior, causa 25% mais dano e recebe 20% menos dano.",
    effectType: "UNDERDOG",
    trigger: "DAMAGE_CALCULATION",
    consumable: false,
    price: 2550,
    rules: { dealtMultiplier: 1.25, receivedMultiplier: 0.8 },
  }),
  item({
    id: "void-fragment",
    name: "Fragmento do Vazio",
    category: "ARTIFACT",
    usageType: "HELD",
    rarity: "LEGENDARY",
    role: "defense",
    shortDescription: "Primeiro super efetivo −70%",
    description: "Reduz em 70% o primeiro ataque super efetivo recebido.",
    effectType: "INCOMING_DAMAGE",
    trigger: "DAMAGE_CALCULATION",
    consumable: true,
    price: 1825,
    rules: { multiplier: 0.3, superEffectiveOnly: true },
  }),
  item({
    id: "celestial-clock",
    name: "Relógio Celestial",
    category: "ARTIFACT",
    usageType: "HELD",
    rarity: "LEGENDARY",
    role: "status",
    shortDescription: "Impede estado • cura 40%",
    description:
      "Impede o primeiro estado negativo e recupera 40% da vida máxima.",
    effectType: "PREVENT_STATUS_AND_HEAL",
    trigger: "BEFORE_STATUS",
    consumable: true,
    price: 1900,
    rules: { healPercent: 0.4 },
  }),
]);

const ITEMS_BY_ID = new Map(ITEM_CATALOG.map((entry) => [entry.id, entry]));
export const HELD_ITEM_CATALOG = Object.freeze(
  ITEM_CATALOG.filter((entry) => entry.usageType === ITEM_USAGE.HELD),
);
export const BAG_ITEM_CATALOG = Object.freeze(
  ITEM_CATALOG.filter((entry) => entry.usageType === ITEM_USAGE.BAG),
);

export function getItemDefinition(id) {
  return (
    ITEMS_BY_ID.get(
      String(id || "")
        .trim()
        .toLowerCase(),
    ) || null
  );
}
export function getItemImage(id) {
  return getItemDefinition(id)?.image || null;
}
export function getRarityLabel(rarity) {
  return RARITY_LABELS[rarity] || rarity || "";
}
export function getUsageLabel(usage) {
  return USAGE_LABELS[usage] || usage || "";
}
export function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "";
}

export const LEGACY_ITEM_MAP = Object.freeze({
  oran: "fruit-vital",
  "oran-berry": "fruit-vital",
  sitrus: "healing-core",
  "sitrus-berry": "healing-core",
  potion: "vital-potion",
  "full-heal": "purifying-elixir",
  "type-boost": "elemental-core",
});

export function migrateLegacyItemId(value) {
  const id = String(value || "")
    .trim()
    .toLowerCase();
  if (!id) return null;
  if (id.endsWith("-boost")) return "elemental-core";
  return LEGACY_ITEM_MAP[id] || (ITEMS_BY_ID.has(id) ? id : null);
}

export function migrateItemInventory(inventory = {}) {
  return Object.entries(inventory).reduce((next, [rawId, rawQuantity]) => {
    const id = migrateLegacyItemId(rawId);
    const quantity = Math.max(0, Math.floor(Number(rawQuantity) || 0));
    if (id && quantity) next[id] = (next[id] || 0) + quantity;
    return next;
  }, {});
}
