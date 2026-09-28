// Metadata and battle-rule lookup for Pokémon Abilities.  This module is
// deliberately framework-free: the engine owns all rolls and mutations.
export const ABILITY_HOOK = Object.freeze({
  ON_ENTER_BATTLE: "ON_ENTER_BATTLE",
  BEFORE_DAMAGE: "BEFORE_DAMAGE",
  AFTER_CONTACT_RECEIVED: "AFTER_CONTACT_RECEIVED",
  ON_STATUS_APPLIED: "ON_STATUS_APPLIED",
  END_OF_TURN: "END_OF_TURN",
});

const ability = (id, namePtBr, shortDescription, hooks, rule = {}) =>
  Object.freeze({ id, namePtBr, shortDescription, description: shortDescription, hooks, rule });

export const ABILITY_CATALOG = Object.freeze({
  "poison-point": ability("poison-point", "Ponto Venenoso", "Ao receber um golpe de contato, pode envenenar quem atacou.", [ABILITY_HOOK.AFTER_CONTACT_RECEIVED], { status: "poison", chance: 0.3 }),
  static: ability("static", "Estática", "Ao receber um golpe de contato, pode paralisar quem atacou.", [ABILITY_HOOK.AFTER_CONTACT_RECEIVED], { status: "paralysis", chance: 0.3 }),
  "flame-body": ability("flame-body", "Corpo de Chamas", "Ao receber um golpe de contato, pode queimar quem atacou.", [ABILITY_HOOK.AFTER_CONTACT_RECEIVED], { status: "burn", chance: 0.3 }),
  "effect-spore": ability("effect-spore", "Esporo de Efeito", "Ao receber contato, pode causar sono, paralisia ou veneno.", [ABILITY_HOOK.AFTER_CONTACT_RECEIVED], { statuses: ["poison", "paralysis", "sleep"], chance: 0.3 }),
  "water-absorb": ability("water-absorb", "Absorção de Água", "Golpes de Água não causam dano e recuperam 1/4 do HP máximo.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "water", healRatio: 0.25 }),
  "volt-absorb": ability("volt-absorb", "Absorção de Eletricidade", "Golpes Elétricos não causam dano e recuperam 1/4 do HP máximo.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "electric", healRatio: 0.25 }),
  levitate: ability("levitate", "Levitação", "Fica imune a golpes do tipo Ground.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "ground" }),
  "flash-fire": ability("flash-fire", "Absorve-Fogo", "Golpes de Fogo não causam dano e fortalecem seus próximos golpes de Fogo nesta batalha.", [ABILITY_HOOK.BEFORE_DAMAGE], { immuneType: "fire", activate: "flash-fire", multiplier: 1.5 }),
  overgrow: ability("overgrow", "Supercrescimento", "Com 1/3 do HP ou menos, golpes Grass causam 50% a mais de dano.", [ABILITY_HOOK.BEFORE_DAMAGE], { lowHpType: "grass", threshold: 1 / 3, multiplier: 1.5 }),
  blaze: ability("blaze", "Chama", "Com 1/3 do HP ou menos, golpes Fire causam 50% a mais de dano.", [ABILITY_HOOK.BEFORE_DAMAGE], { lowHpType: "fire", threshold: 1 / 3, multiplier: 1.5 }),
  torrent: ability("torrent", "Torrente", "Com 1/3 do HP ou menos, golpes Water causam 50% a mais de dano.", [ABILITY_HOOK.BEFORE_DAMAGE], { lowHpType: "water", threshold: 1 / 3, multiplier: 1.5 }),
  swarm: ability("swarm", "Enxame", "Com 1/3 do HP ou menos, golpes Bug causam 50% a mais de dano.", [ABILITY_HOOK.BEFORE_DAMAGE], { lowHpType: "bug", threshold: 1 / 3, multiplier: 1.5 }),
  intimidate: ability("intimidate", "Intimidação", "Ao entrar, reduz o Ataque do adversário em um estágio.", [ABILITY_HOOK.ON_ENTER_BATTLE], { stat: "attack", stages: -1 }),
  "speed-boost": ability("speed-boost", "Impulso", "Ao fim do próprio turno, aumenta a Velocidade em um estágio.", [ABILITY_HOOK.END_OF_TURN], { stat: "speed", stages: 1 }),
  synchronize: ability("synchronize", "Sincronismo", "Ao receber queimadura, paralisia ou veneno, tenta refletir a mesma condição uma vez.", [ABILITY_HOOK.ON_STATUS_APPLIED], { statuses: ["burn", "paralysis", "poison"] }),
});

export const SUPPORTED_ABILITY_IDS = Object.freeze(Object.keys(ABILITY_CATALOG));
export const normalizeAbilityId = (value) => {
  const raw = typeof value === "string" ? value : value?.name;
  return typeof raw === "string" ? raw.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-") || null : null;
};
export const getAbilityDefinition = (id) => ABILITY_CATALOG[normalizeAbilityId(id)] || null;
export const getSupportedAbility = (id) => getAbilityDefinition(id);
export const isAbilitySupported = (id) => Boolean(getAbilityDefinition(id));

export function getDamageAbilityRule({ attacker, defender, attackType, hpRatio }) {
  const defenderAbility = getAbilityDefinition(defender?.abilityId || defender?.ability);
  if (defenderAbility?.rule?.immuneType === attackType) return { kind: "immunity", ability: defenderAbility, healRatio: defenderAbility.rule.healRatio || 0, activate: defenderAbility.rule.activate || null };
  const attackerAbility = getAbilityDefinition(attacker?.abilityId || attacker?.ability);
  if (attackerAbility?.rule?.lowHpType === attackType && hpRatio <= attackerAbility.rule.threshold)
    return { kind: "boost", ability: attackerAbility, multiplier: attackerAbility.rule.multiplier };
  if (attacker?.temporaryEffects?.flashFire && attackType === "fire")
    return { kind: "boost", ability: getAbilityDefinition("flash-fire"), multiplier: 1.5, activated: true };
  return null;
}

export function getContactAbilityRule(defender, roll) {
  const ability = getAbilityDefinition(defender?.abilityId || defender?.ability);
  if (!ability?.hooks.includes(ABILITY_HOOK.AFTER_CONTACT_RECEIVED)) return null;
  if (roll >= ability.rule.chance) return null;
  const statuses = ability.rule.statuses || [ability.rule.status];
  // One canonical 30% roll, then an equal deterministic choice amongst the
  // supported Effect Spore outcomes; no extra independent chance roll.
  const status = statuses.length === 1 ? statuses[0] : statuses[Math.min(statuses.length - 1, Math.floor((roll / ability.rule.chance) * statuses.length))];
  return { ability, status, chance: ability.rule.chance };
}

export function getContactAbilityPreview(defender) {
  const ability = getAbilityDefinition(defender?.abilityId || defender?.ability);
  if (!ability?.hooks.includes(ABILITY_HOOK.AFTER_CONTACT_RECEIVED)) return null;
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
