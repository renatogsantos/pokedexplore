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
    equipmentSlot: definition.equipmentSlot || (definition.usageType === "HELD" ? "STRATEGIC" : null),
    ...definition,
    rules: Object.freeze(definition.rules || {}),
  });

const elementalRelic = ({ id, name, type, description, shortDescription, rules = {}, price = 330 }) =>
  item({ id, name, category: "ARTIFACT", usageType: "HELD", equipmentSlot: "ELEMENTAL_RELIC", rarity: "RARE", role: "attack", shortDescription, description, effectType: "ELEMENTAL_RELIC", trigger: "DAMAGE_CALCULATION", consumable: false, price, elementalType: type, rules: { type, baseMultiplier: 1.12, ...rules } });

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
    shortDescription: "Recupera 10% do dano causado",
    description:
      "Após causar dano direto, recupera 10% do dano realmente causado.",
    effectType: "DRAIN_DAMAGE",
    trigger: "AFTER_DAMAGE_DEALT",
    consumable: false,
    price: 330,
    rules: { damageHealPercent: 0.1 },
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
    battleUsage: { maxPerPokemon: 3, category: "HEALING" },
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
    battleUsage: { maxPerPokemon: 2, category: "HEALING" },
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
    battleUsage: { maxPerPokemon: 2, category: "STATUS_CURE" },
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
    battleUsage: { maxPerPokemon: 2, category: "DEFENSIVE", blocksDuplicatePendingEffect: true },
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
    battleUsage: { maxPerPokemon: 3, category: "OFFENSIVE", blocksDuplicatePendingEffect: true },
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
    battleUsage: { maxPerPokemon: 1, category: "RESOURCE" },
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
  item({ id: "fragmento-da-ruina", name: "Fragmento da Ruína", category: "ARTIFACT", usageType: "BAG", rarity: "EPIC", role: "tactical", shortDescription: "Ruína por 3 rodadas", description: "Aplica Ruína ao Pokémon inimigo ativo. Ao fim de cada rodada, ele perde 5% do HP máximo por 3 rodadas.", effectType: "BAG_RUIN", trigger: "MANUAL", consumable: true, price: 300, rules: { rounds: 3, damagePercent: .05 }, battleUsage: { maxPerPokemon: 1, category: "TACTICAL", target: "ENEMY_ACTIVE" } }),
  item({ id: "espelho-prismatico", name: "Espelho Prismático", category: "ARTIFACT", usageType: "HELD", rarity: "LEGENDARY", role: "defense", shortDescription: "Reflete 50% de Especial", description: "Na primeira vez que receber um golpe Especial com dano, reflete 50% do dano realmente sofrido ao atacante e é consumido.", effectType: "REFLECT_SPECIAL", trigger: "AFTER_DAMAGE", consumable: true, price: 2200, rules: { reflectPercent: .5 } }),
  item({ id: "bomba-temporal", name: "Bomba Temporal", category: "ARTIFACT", usageType: "BAG", rarity: "EPIC", role: "tactical", shortDescription: "15% após 3 rodadas", description: "Anexa uma bomba ao inimigo. Após 3 rodadas completas, causa 15% do HP máximo.", effectType: "BAG_TIME_BOMB", trigger: "MANUAL", consumable: true, price: 330, rules: { rounds: 3, damagePercent: .15 }, battleUsage: { maxPerPokemon: 1, category: "TACTICAL", target: "ENEMY_ACTIVE" } }),
  item({ id: "marca-do-cacador", name: "Marca do Caçador", category: "ARTIFACT", usageType: "BAG", rarity: "RARE", role: "attack", shortDescription: "Alvo recebe +10%", description: "Marca o inimigo por 3 rodadas. Seus golpes causam 10% mais dano contra ele.", effectType: "BAG_HUNTER_MARK", trigger: "MANUAL", consumable: true, price: 150, rules: { rounds: 3, multiplier: 1.1 }, battleUsage: { maxPerPokemon: 2, category: "OFFENSIVE", target: "ENEMY_ACTIVE" } }),
  item({ id: "escudo-refletor", name: "Escudo Refletor", category: "DEFENSE", usageType: "BAG", rarity: "EPIC", role: "defense", shortDescription: "−30% e reflete 30%", description: "No próximo ataque recebido, reduz 30% do dano e reflete 30% do dano realmente sofrido.", effectType: "BAG_REFLECT_SHIELD", trigger: "MANUAL", consumable: true, price: 300, rules: { mitigationMultiplier: .7, reflectPercent: .3 }, battleUsage: { maxPerPokemon: 1, category: "DEFENSIVE", target: "ACTIVE" } }),
  item({ id: "parasita-de-energia", name: "Parasita de Energia", category: "ARTIFACT", usageType: "BAG", rarity: "EPIC", role: "tactical", shortDescription: "Rouba 1 Momentum", description: "Remove 1 Momentum do inimigo ativo e concede 1 Momentum ao usuário.", effectType: "BAG_STEAL_MOMENTUM", trigger: "MANUAL", consumable: true, price: 300, battleUsage: { maxPerPokemon: 2, category: "RESOURCE", target: "ENEMY_ACTIVE" } }),
  item({ id: "selo-do-silencio", name: "Selo do Silêncio", category: "ARTIFACT", usageType: "BAG", rarity: "LEGENDARY", role: "tactical", shortDescription: "Bloqueia o próximo Especial", description: "Bloqueia o próximo turno acionável de golpe Especial do inimigo, sem impedir outros movimentos, itens ou troca.", effectType: "BAG_SILENCE", trigger: "MANUAL", consumable: true, price: 1900, rules: { rounds: 1 }, battleUsage: { maxPerPokemon: 1, category: "TACTICAL", target: "ENEMY_ACTIVE" } }),
  item({ id: "cristal-da-furia", name: "Cristal da Fúria", category: "CRYSTAL", usageType: "HELD", rarity: "EPIC", role: "attack", shortDescription: "Fúria com HP baixo", description: "Ao chegar a 25% de HP ou menos, por 2 rodadas causa 20% mais dano e recebe 10% mais dano.", effectType: "FURY", trigger: "AFTER_DAMAGE", consumable: false, price: 330, rules: { hpRatioLTE: .25, rounds: 2, dealtMultiplier: 1.2, receivedMultiplier: 1.1 } }),
  item({ id: "ancora-dimensional", name: "Âncora Dimensional", category: "ARTIFACT", usageType: "BAG", rarity: "RARE", role: "tactical", shortDescription: "Bloqueia troca por 2 rodadas", description: "O inimigo não pode fazer trocas voluntárias por 2 rodadas.", effectType: "BAG_ANCHOR", trigger: "MANUAL", consumable: true, price: 150, rules: { rounds: 2 }, battleUsage: { maxPerPokemon: 2, category: "TACTICAL", target: "ENEMY_ACTIVE" } }),
  item({ id: "mina-elemental", name: "Mina Elemental", category: "ARTIFACT", usageType: "BAG", rarity: "EPIC", role: "tactical", shortDescription: "10% no próximo switch", description: "Mina o lado inimigo. A próxima troca voluntária do inimigo causa 10% do HP máximo ao Pokémon que entrar.", effectType: "BAG_ELEMENTAL_MINE", trigger: "MANUAL", consumable: true, price: 300, rules: { damagePercent: .1 }, battleUsage: { maxPerPokemon: 2, category: "TACTICAL", target: "ENEMY_SIDE" } }),
  item({ id: "nucleo-de-sobrecarga", name: "Núcleo de Sobrecarga", category: "CORE", usageType: "BAG", rarity: "EPIC", role: "attack", shortDescription: "+2 Momentum, recebe +15%", description: "Concede 2 Momentum ao ativo. No próximo ataque recebido, ele sofre 15% mais dano.", effectType: "BAG_OVERLOAD", trigger: "MANUAL", consumable: true, price: 300, rules: { momentum: 2, receivedMultiplier: 1.15 }, battleUsage: { maxPerPokemon: 1, category: "RESOURCE", target: "ACTIVE" } }),
  item({ id: "ampulheta-quebrada", name: "Ampulheta Quebrada", category: "ARTIFACT", usageType: "HELD", rarity: "LEGENDARY", role: "special", shortDescription: "Último Especial devolve +1", description: "Após usar legitimamente o último golpe Especial, restaura 1 uso uma única vez e é consumida.", effectType: "RESTORE_SPECIAL", trigger: "AFTER_SPECIAL_EXHAUSTED", consumable: true, price: 1800, rules: { amount: 1 } }),
  elementalRelic({ id: "brasa-primordial", name: "Brasa Primordial", type: "fire", shortDescription: "Fogo +12%/+18%", description: "Para Pokémon de Fogo: golpes de Fogo causam 12% mais dano, ou 18% abaixo de 40% de HP.", rules: { lowHpRatio: .4, lowHpMultiplier: 1.18 } }),
  elementalRelic({ id: "perola-abissal", name: "Pérola Abissal", type: "water", shortDescription: "Água +12%, defesa baixa", description: "Para Pokémon de Água: golpes de Água causam 12% mais dano; abaixo de 40% de HP, recebe 8% menos dano.", rules: { lowHpRatio: .4, incomingMultiplier: .92 } }),
  elementalRelic({ id: "condutor-de-tempestade", name: "Condutor de Tempestade", type: "electric", shortDescription: "Elétrico +12%/+18%", description: "Para Pokémon Elétricos: golpes Elétricos causam 12% mais dano, ou 18% contra alvo paralisado.", rules: { status: "paralysis", statusMultiplier: 1.18 } }),
  elementalRelic({ id: "semente-ancestral", name: "Semente Ancestral", type: "grass", shortDescription: "Grama +12% e regenera", description: "Para Pokémon de Grama: golpes de Grama causam 12% mais dano. Em HP baixo, recupera 3% ao fim da rodada até 3 vezes.", rules: { lowHpRatio: .35, endRoundHealPercent: .03, maxTicks: 3 } }),
  elementalRelic({ id: "coracao-glacial", name: "Coração Glacial", type: "ice", shortDescription: "Gelo +12%, reduz super eficaz", description: "Para Pokémon de Gelo: golpes de Gelo causam 12% mais dano e golpes super eficazes recebidos sofrem redução adicional de 5%.", rules: { superEffectiveIncomingMultiplier: .95 } }),
  elementalRelic({ id: "faixa-do-tita", name: "Faixa do Titã", type: "fighting", shortDescription: "Luta +12%/+17%", description: "Para Pokémon Lutadores: golpes de Luta causam 12% mais dano; abaixo de 50% de HP, golpes de contato recebem mais 5%.", rules: { lowHpRatio: .5, contactMultiplier: 1.17 } }),
  elementalRelic({ id: "presa-toxica", name: "Presa Tóxica", type: "poison", shortDescription: "Veneno +12%, chance +5pp", description: "Para Pokémon de Veneno: golpes de Veneno causam 12% mais dano e golpes que já envenenam recebem 5 pontos percentuais de chance.", rules: { poisonChanceBonus: .05 } }),
  elementalRelic({ id: "nucleo-sismico", name: "Núcleo Sísmico", type: "ground", shortDescription: "Terra +12%/+17% após troca", description: "Para Pokémon de Terra: golpes de Terra causam 12% mais dano; o primeiro após entrar voluntariamente recebe mais 5%.", rules: { switchInMultiplier: 1.17 } }),
  elementalRelic({ id: "pluma-celeste", name: "Pluma Celeste", type: "flying", shortDescription: "Voador +12%, defesa após troca", description: "Para Pokémon Voadores: golpes de Voador causam 12% mais dano e o primeiro dano recebido após troca voluntária é reduzido em 5%.", rules: { switchInIncomingMultiplier: .95 } }),
  elementalRelic({ id: "prisma-mental", name: "Prisma Mental", type: "psychic", shortDescription: "Psíquico +12%, Técnico +5pp", description: "Para Pokémon Psíquicos: golpes Psíquicos causam 12% mais dano; com Momentum máximo, Técnico recebe mais 5 pontos percentuais.", rules: { technicalMomentumBonus: .05 } }),
  elementalRelic({ id: "casulo-ancestral", name: "Casulo Ancestral", type: "bug", shortDescription: "Inseto +12%, proteção baixa", description: "Para Pokémon Insetos: golpes de Inseto causam 12% mais dano; ao entrar abaixo de 50% de HP, reduz 5% do dano até atacar com sucesso.", rules: { entryHpRatio: .5, incomingMultiplier: .95 } }),
  elementalRelic({ id: "fragmento-colossal", name: "Fragmento Colossal", type: "rock", shortDescription: "Pedra +12%, primeiro dano −8%", description: "Para Pokémon de Pedra: golpes de Pedra causam 12% mais dano e o primeiro dano recebido em HP cheio é reduzido em 8%.", rules: { fullHpIncomingMultiplier: .92 } }),
  elementalRelic({ id: "veu-espectral", name: "Véu Espectral", type: "ghost", shortDescription: "Fantasma +12%, Momentum ao nocautear", description: "Para Pokémon Fantasma: golpes de Fantasma causam 12% mais dano e cada nocaute concede 1 Momentum, até o máximo.", rules: { momentumOnFaint: 1 } }),
  elementalRelic({ id: "escama-draconica", name: "Escama Dracônica", type: "dragon", shortDescription: "Dragão +12%/+18%", description: "Para Pokémon Dragão: golpes de Dragão causam 12% mais dano, ou 18% contra outro Dragão.", rules: { opponentType: "dragon", opponentMultiplier: 1.18 } }),
  elementalRelic({ id: "orbe-sombrio", name: "Orbe Sombrio", type: "dark", shortDescription: "Sombrio +12%/+18%", description: "Para Pokémon Sombrios: golpes Sombrios causam 12% mais dano, ou 18% contra alvo com estado negativo.", rules: { targetStatusMultiplier: 1.18 } }),
  elementalRelic({ id: "liga-arcana", name: "Liga Arcana", type: "steel", shortDescription: "Aço +12%, super eficaz −5%", description: "Para Pokémon de Aço: golpes de Aço causam 12% mais dano e golpes super eficazes recebidos sofrem redução adicional de 5%.", rules: { superEffectiveIncomingMultiplier: .95 } }),
  elementalRelic({ id: "cristal-feerico", name: "Cristal Feérico", type: "fairy", shortDescription: "Fada +12%/+18%", description: "Para Pokémon Fada: golpes de Fada causam 12% mais dano, ou 18% contra Dragões.", rules: { opponentType: "dragon", opponentMultiplier: 1.18 } }),
  elementalRelic({ id: "simbolo-primordial", name: "Símbolo Primordial", type: "normal", shortDescription: "Normal +12%/+15% neutro", description: "Para Pokémon Normais: golpes Normais causam 12% mais dano e recebem mais 3% quando não são super eficazes.", rules: { neutralMultiplier: 1.15 } }),
]);

const ITEMS_BY_ID = new Map(ITEM_CATALOG.map((entry) => [entry.id, entry]));
export const HELD_ITEM_CATALOG = Object.freeze(
  ITEM_CATALOG.filter((entry) => entry.usageType === ITEM_USAGE.HELD),
);
export const BAG_ITEM_CATALOG = Object.freeze(
  ITEM_CATALOG.filter((entry) => entry.usageType === ITEM_USAGE.BAG),
);
export const STRATEGIC_ITEM_CATALOG = Object.freeze(
  HELD_ITEM_CATALOG.filter((entry) => entry.equipmentSlot !== "ELEMENTAL_RELIC"),
);
export const ELEMENTAL_RELIC_CATALOG = Object.freeze(
  HELD_ITEM_CATALOG.filter((entry) => entry.equipmentSlot === "ELEMENTAL_RELIC"),
);
export const ELEMENTAL_RELICS_BY_TYPE = Object.freeze(
  ELEMENTAL_RELIC_CATALOG.reduce((index, relic) => {
    index[relic.elementalType] = relic;
    return index;
  }, {}),
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

// Player-facing copy derived from the authoritative catalog. Every item UI
// consumes this layer instead of duplicating gameplay rules in components.
export function getItemUsagePresentation(itemOrId) {
  const item = typeof itemOrId === "string" ? getItemDefinition(itemOrId) : itemOrId;
  if (!item) return null;
  const rules = item.rules || {};
  const percent = (value) => `${Math.round(Number(value || 0) * 100)}%`;
  const triggerLabel = {
    MANUAL: "Você usa manualmente durante a batalha.",
    AFTER_DAMAGE: `Ativa automaticamente após receber dano${rules.hpRatioLTE != null ? `, quando o HP fica em ${percent(rules.hpRatioLTE)} ou menos` : ""}.`,
    BEFORE_LETHAL_DAMAGE: "Ativa automaticamente quando um golpe seria fatal.",
    BEFORE_STATUS: "Ativa automaticamente antes de um estado negativo ser aplicado.",
    AFTER_STATUS: "Ativa automaticamente quando um estado negativo é aplicado.",
    AFTER_DAMAGE_DEALT: "Ativa após causar dano direto.",
    AFTER_SWITCH_IN: "Prepara o próximo ataque após entrar por uma troca.",
    BEFORE_SWITCH_OUT: "Ativa ao sair voluntariamente da batalha com vida.",
    PASSIVE: "Funciona passivamente durante a batalha.",
    DAMAGE_CALCULATION: item.effectType === "NEXT_ATTACK" || item.effectType === "SPECIAL_DAMAGE"
      ? "Ativa no próximo ataque válido que acertar."
      : "Funciona automaticamente ao calcular o dano.",
  }[item.trigger] || "Funciona conforme a condição da batalha.";
  return {
    usageLabel: item.usageType === ITEM_USAGE.HELD ? "EQUIPÁVEL" : "MOCHILA",
    persistenceLabel: item.consumable ? "CONSUMÍVEL" : "PERMANENTE",
    triggerLabel,
    effectLabel: item.description || item.shortDescription,
    afterUseLabel: item.consumable
      ? item.usageType === ITEM_USAGE.HELD
        ? "Depois de ativar, é consumido e o Pokémon fica sem item equipado."
        : "Depois de um uso válido, uma unidade é consumida."
      : "Permanece equipado depois de funcionar.",
  };
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
