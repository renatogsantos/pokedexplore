// Metadata and battle-rule lookup for Pokémon Abilities.  This module is
// deliberately framework-free: the engine owns all rolls and mutations.
export const ABILITY_HOOK = Object.freeze({
  ON_ENTER_BATTLE: "ON_ENTER_BATTLE",
  BEFORE_DAMAGE: "BEFORE_DAMAGE",
  AFTER_CONTACT_RECEIVED: "AFTER_CONTACT_RECEIVED",
  ON_STATUS_APPLIED: "ON_STATUS_APPLIED",
  END_OF_TURN: "END_OF_TURN",
  ON_SWITCH_OUT: "ON_SWITCH_OUT",
  ON_FAINT_OPPONENT: "ON_FAINT_OPPONENT",
});

const ability = (id, namePtBr, shortDescription, hooks, rule = {}) =>
  Object.freeze({
    id,
    namePtBr,
    shortDescription,
    description: shortDescription,
    hooks,
    rule,
  });

export const ABILITY_CATALOG = Object.freeze({
  "poison-point": ability(
    "poison-point",
    "Ponto Venenoso",
    "Ao receber um golpe de contato, pode envenenar quem atacou.",
    [ABILITY_HOOK.AFTER_CONTACT_RECEIVED],
    { status: "poison", chance: 0.3 },
  ),
  static: ability(
    "static",
    "Estática",
    "Ao receber um golpe de contato, pode paralisar quem atacou.",
    [ABILITY_HOOK.AFTER_CONTACT_RECEIVED],
    { status: "paralysis", chance: 0.3 },
  ),
  "flame-body": ability(
    "flame-body",
    "Corpo de Chamas",
    "Ao receber um golpe de contato, pode queimar quem atacou.",
    [ABILITY_HOOK.AFTER_CONTACT_RECEIVED],
    { status: "burn", chance: 0.3 },
  ),
  "effect-spore": ability(
    "effect-spore",
    "Esporo de Efeito",
    "Ao receber contato, pode causar sono, paralisia ou veneno.",
    [ABILITY_HOOK.AFTER_CONTACT_RECEIVED],
    { statuses: ["poison", "paralysis", "sleep"], chance: 0.3 },
  ),
  "water-absorb": ability(
    "water-absorb",
    "Absorção de Água",
    "Golpes de Água não causam dano e recuperam 1/4 do HP máximo.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { immuneType: "water", healRatio: 0.25 },
  ),
  "volt-absorb": ability(
    "volt-absorb",
    "Absorção de Eletricidade",
    "Golpes Elétricos não causam dano e recuperam 1/4 do HP máximo.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { immuneType: "electric", healRatio: 0.25 },
  ),
  levitate: ability(
    "levitate",
    "Levitação",
    "Fica imune a golpes do tipo Ground.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { immuneType: "ground" },
  ),
  "flash-fire": ability(
    "flash-fire",
    "Absorve-Fogo",
    "Golpes de Fogo não causam dano e fortalecem seus próximos golpes de Fogo nesta batalha.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { immuneType: "fire", activate: "flash-fire", multiplier: 1.5 },
  ),
  overgrow: ability(
    "overgrow",
    "Supercrescimento",
    "Com 1/3 do HP ou menos, golpes Grass causam 50% a mais de dano.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { lowHpType: "grass", threshold: 1 / 3, multiplier: 1.5 },
  ),
  blaze: ability(
    "blaze",
    "Chama",
    "Com 1/3 do HP ou menos, golpes Fire causam 50% a mais de dano.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { lowHpType: "fire", threshold: 1 / 3, multiplier: 1.5 },
  ),
  torrent: ability(
    "torrent",
    "Torrente",
    "Com 1/3 do HP ou menos, golpes Water causam 50% a mais de dano.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { lowHpType: "water", threshold: 1 / 3, multiplier: 1.5 },
  ),
  swarm: ability(
    "swarm",
    "Enxame",
    "Com 1/3 do HP ou menos, golpes Bug causam 50% a mais de dano.",
    [ABILITY_HOOK.BEFORE_DAMAGE],
    { lowHpType: "bug", threshold: 1 / 3, multiplier: 1.5 },
  ),
  intimidate: ability(
    "intimidate",
    "Intimidação",
    "Ao entrar, reduz o Ataque do adversário em um estágio.",
    [ABILITY_HOOK.ON_ENTER_BATTLE],
    { stat: "attack", stages: -1 },
  ),
  "speed-boost": ability(
    "speed-boost",
    "Impulso",
    "Ao fim do próprio turno, aumenta a Velocidade em um estágio.",
    [ABILITY_HOOK.END_OF_TURN],
    { stat: "speed", stages: 1 },
  ),
  synchronize: ability(
    "synchronize",
    "Sincronismo",
    "Ao receber queimadura, paralisia ou veneno, tenta refletir a mesma condição uma vez.",
    [ABILITY_HOOK.ON_STATUS_APPLIED],
    { statuses: ["burn", "paralysis", "poison"] },
  ),
  sturdy: ability("sturdy", "Robustez", "Com HP cheio, resiste a um golpe que causaria nocaute com 1 HP.", [ABILITY_HOOK.BEFORE_DAMAGE], { surviveAtFullHp: true }),
  "thick-fat": ability("thick-fat", "Gordura Espessa", "Reduz pela metade o dano de golpes Fire e Ice.", [ABILITY_HOOK.BEFORE_DAMAGE], { damageTypes: ["fire", "ice"], damageMultiplier: 0.5 }),
  multiscale: ability("multiscale", "Multiescamas", "Com HP cheio, reduz pela metade o dano recebido.", [ABILITY_HOOK.BEFORE_DAMAGE], { fullHpDamageMultiplier: 0.5 }),
  filter: ability("filter", "Filtro", "Reduz o dano de golpes super efetivos.", [ABILITY_HOOK.BEFORE_DAMAGE], { superEffectiveDamageMultiplier: 0.75 }),
  "solid-rock": ability("solid-rock", "Rocha SÃ³lida", "Reduz o dano de golpes super efetivos.", [ABILITY_HOOK.BEFORE_DAMAGE], { superEffectiveDamageMultiplier: 0.75 }),
  adaptability: ability("adaptability", "Adaptabilidade", "Fortalece o bÃ´nus de golpes do mesmo tipo.", [ABILITY_HOOK.BEFORE_DAMAGE], { stabMultiplier: 2 }),
  technician: ability("technician", "TÃ©cnico", "Fortalece golpes com poder base de 60 ou menos.", [ABILITY_HOOK.BEFORE_DAMAGE], { maxPower: 60, multiplier: 1.5 }),
  "iron-fist": ability("iron-fist", "Punho de Ferro", "Fortalece golpes de soco.", [ABILITY_HOOK.BEFORE_DAMAGE], { trait: "PUNCH", multiplier: 1.2 }),
  "strong-jaw": ability("strong-jaw", "MandÃ­bula Forte", "Fortalece golpes de mordida.", [ABILITY_HOOK.BEFORE_DAMAGE], { trait: "BITE", multiplier: 1.5 }),
  "rough-skin": ability("rough-skin", "Pele Ãspera", "Golpes de contato causam dano ao atacante.", [ABILITY_HOOK.AFTER_CONTACT_RECEIVED], { contactDamageRatio: 1 / 8 }),
  "iron-barbs": ability("iron-barbs", "Espinhos de Ferro", "Golpes de contato causam dano ao atacante.", [ABILITY_HOOK.AFTER_CONTACT_RECEIVED], { contactDamageRatio: 1 / 8 }),
  immunity: ability("immunity", "Imunidade", "NÃ£o pode ser envenenado.", [ABILITY_HOOK.ON_STATUS_APPLIED], { preventsStatuses: ["poison"] }),
  limber: ability("limber", "Flexibilidade", "NÃ£o pode ser paralisado.", [ABILITY_HOOK.ON_STATUS_APPLIED], { preventsStatuses: ["paralysis"] }),
  insomnia: ability("insomnia", "InsÃ´nia", "NÃ£o pode dormir.", [ABILITY_HOOK.ON_STATUS_APPLIED], { preventsStatuses: ["sleep"] }),
  "vital-spirit": ability("vital-spirit", "EspÃ­rito Vital", "NÃ£o pode dormir.", [ABILITY_HOOK.ON_STATUS_APPLIED], { preventsStatuses: ["sleep"] }),
  "own-tempo": ability("own-tempo", "Ritmo PrÃ³prio", "NÃ£o pode ficar confuso.", [ABILITY_HOOK.ON_STATUS_APPLIED], { preventsStatuses: ["confusion"] }),
  regenerator: ability("regenerator", "RegeneraÃ§Ã£o", "Ao trocar normalmente, recupera 1/3 do HP mÃ¡ximo.", [ABILITY_HOOK.ON_SWITCH_OUT], { healRatio: 1 / 3 }),
  moxie: ability("moxie", "Ãmpeto", "Ao derrubar um adversÃ¡rio, aumenta o Ataque.", [ABILITY_HOOK.ON_FAINT_OPPONENT], { stat: "attack", stages: 1 }),
  defiant: ability("defiant", "Desafio", "Quando um adversÃ¡rio reduz seus atributos, aumenta muito o Ataque.", [ABILITY_HOOK.ON_STATUS_APPLIED], { reactsToStatDrop: true, stat: "attack", stages: 2 }),
  competitive: ability("competitive", "Competitivo", "Quando um adversÃ¡rio reduz seus atributos, aumenta muito o Ataque Especial.", [ABILITY_HOOK.ON_STATUS_APPLIED], { reactsToStatDrop: true, stat: "specialAttack", stages: 2 }),
  "sap-sipper": ability("sap-sipper", "HerbÃ­voro", "Golpes Grass nÃ£o causam dano e aumentam o Ataque.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "grass", stat: "attack", stages: 1 }),
  "lightning-rod": ability("lightning-rod", "Para-Raios", "Golpes Electric nÃ£o causam dano e aumentam o Ataque Especial.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "electric", stat: "specialAttack", stages: 1 }),
  "storm-drain": ability("storm-drain", "Dreno de Ãgua", "Golpes Water nÃ£o causam dano e aumentam o Ataque Especial.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "water", stat: "specialAttack", stages: 1 }),
});

export const SUPPORTED_ABILITY_IDS = Object.freeze(
  Object.keys(ABILITY_CATALOG),
);
export const normalizeAbilityId = (value) => {
  const raw = typeof value === "string" ? value : value?.name;
  return typeof raw === "string"
    ? raw.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-") || null
    : null;
};
export const getAbilityDefinition = (id) =>
  ABILITY_CATALOG[normalizeAbilityId(id)] || null;
export const getSupportedAbility = (id) => getAbilityDefinition(id);
export const isAbilitySupported = (id) => Boolean(getAbilityDefinition(id));

export function getDamageAbilityRule({
  attacker,
  defender,
  attackType,
  hpRatio,
}) {
  const defenderAbility = getAbilityDefinition(
    defender?.abilityId || defender?.ability,
  );
  if (defenderAbility?.rule?.immuneType === attackType)
    return {
      kind: "immunity",
      ability: defenderAbility,
      healRatio: defenderAbility.rule.healRatio || 0,
      activate: defenderAbility.rule.activate || null,
      stat: defenderAbility.rule.stat || null,
      stages: defenderAbility.rule.stages || 0,
    };
  const attackerAbility = getAbilityDefinition(
    attacker?.abilityId || attacker?.ability,
  );
  if (
    attackerAbility?.rule?.lowHpType === attackType &&
    hpRatio <= attackerAbility.rule.threshold
  )
    return {
      kind: "boost",
      ability: attackerAbility,
      multiplier: attackerAbility.rule.multiplier,
    };
  if (attacker?.temporaryEffects?.flashFire && attackType === "fire")
    return {
      kind: "boost",
      ability: getAbilityDefinition("flash-fire"),
      multiplier: 1.5,
      activated: true,
    };
  return null;
}

export function getDamageModifiers({ attacker, defender, move, attackType, effectiveness, attackerHpRatio, defenderHpRatio }) {
  const attackerAbility = getAbilityDefinition(attacker?.abilityId || attacker?.ability);
  const defenderAbility = getAbilityDefinition(defender?.abilityId || defender?.ability);
  const outgoing = [];
  const incoming = [];
  if (attackerAbility?.id === "adaptability" && (attacker?.types || [attacker?.type]).includes(attackType)) outgoing.push({ ability: attackerAbility, multiplier: attackerAbility.rule.stabMultiplier, kind: "stab" });
  if (attackerAbility?.id === "technician" && Number(move?.power) <= attackerAbility.rule.maxPower) outgoing.push({ ability: attackerAbility, multiplier: attackerAbility.rule.multiplier, kind: "power" });
  if (attackerAbility?.rule?.trait && move?.traits?.includes(attackerAbility.rule.trait)) outgoing.push({ ability: attackerAbility, multiplier: attackerAbility.rule.multiplier, kind: "trait" });
  if (defenderAbility?.rule?.damageTypes?.includes(attackType)) incoming.push({ ability: defenderAbility, multiplier: defenderAbility.rule.damageMultiplier, kind: "type_reduction" });
  if (defenderAbility?.rule?.fullHpDamageMultiplier && defenderHpRatio >= 1) incoming.push({ ability: defenderAbility, multiplier: defenderAbility.rule.fullHpDamageMultiplier, kind: "full_hp_reduction" });
  if (defenderAbility?.rule?.superEffectiveDamageMultiplier && effectiveness > 1) incoming.push({ ability: defenderAbility, multiplier: defenderAbility.rule.superEffectiveDamageMultiplier, kind: "super_effective_reduction" });
  return { outgoing, incoming };
}

export function getStatusPreventionRule(target, statusId) {
  const ability = getAbilityDefinition(target?.abilityId || target?.ability);
  return ability?.rule?.preventsStatuses?.includes(statusId) ? ability : null;
}

export function getContactRecoilRule(defender) {
  const ability = getAbilityDefinition(defender?.abilityId || defender?.ability);
  return ability?.rule?.contactDamageRatio ? { ability, ratio: ability.rule.contactDamageRatio } : null;
}

export function getContactAbilityRule(defender, roll) {
  const ability = getAbilityDefinition(
    defender?.abilityId || defender?.ability,
  );
  if (!ability?.hooks.includes(ABILITY_HOOK.AFTER_CONTACT_RECEIVED) || !ability.rule.status && !ability.rule.statuses)
    return null;
  if (roll >= ability.rule.chance) return null;
  const statuses = ability.rule.statuses || [ability.rule.status];
  // One canonical 30% roll, then an equal deterministic choice amongst the
  // supported Effect Spore outcomes; no extra independent chance roll.
  const status =
    statuses.length === 1
      ? statuses[0]
      : statuses[
          Math.min(
            statuses.length - 1,
            Math.floor((roll / ability.rule.chance) * statuses.length),
          )
        ];
  return { ability, status, chance: ability.rule.chance };
}

export function getContactAbilityPreview(defender) {
  const ability = getAbilityDefinition(
    defender?.abilityId || defender?.ability,
  );
  if (!ability?.hooks.includes(ABILITY_HOOK.AFTER_CONTACT_RECEIVED) || !ability.rule.status && !ability.rule.statuses)
    return null;
  return {
    ability,
    statuses: ability.rule.statuses || [ability.rule.status],
    chance: ability.rule.chance,
  };
}

export function getEnterAbilityRule(fighter) {
  const ability = getAbilityDefinition(fighter?.abilityId || fighter?.ability);
  return ability?.hooks.includes(ABILITY_HOOK.ON_ENTER_BATTLE) ? ability : null;
}

export function getEndTurnAbilityRule(fighter) {
  const ability = getAbilityDefinition(fighter?.abilityId || fighter?.ability);
  return ability?.hooks.includes(ABILITY_HOOK.END_OF_TURN) ? ability : null;
}
