import { normalizePokemonEquipment } from "@/lib/economy/heldItems";

export const MAX_POKEMON_LEVEL = 10;
export const STAT_BONUS_PER_LEVEL = 0.05;

export function getPokemonLevel(pokemon) {
  return Math.min(MAX_POKEMON_LEVEL, Math.max(1, Number(pokemon?.level) || 1));
}

export function getStatMultiplier(level = 1) {
  return 1 + (getPokemonLevel({ level }) - 1) * STAT_BONUS_PER_LEVEL;
}

export function getBaseStats(pokemon) {
  if (pokemon?.baseStats?.hp) return { hp: pokemon.baseStats.hp, attack: pokemon.baseStats.attack || 50, defense: pokemon.baseStats.defense || 50, specialAttack: pokemon.baseStats.specialAttack || pokemon.baseStats.attack || 50, specialDefense: pokemon.baseStats.specialDefense || pokemon.baseStats.defense || 50, speed: pokemon.baseStats.speed || 50 };
  const stats = Array.isArray(pokemon?.stats) ? pokemon.stats : [];
  const findStat = (name, fallback) => stats.find((stat) => stat?.stat?.name === name)?.base_stat || fallback;
  return { hp: findStat("hp", pokemon?.maxHp || 90), attack: findStat("attack", 50), defense: findStat("defense", 50), specialAttack: findStat("special-attack", 50), specialDefense: findStat("special-defense", 50), speed: findStat("speed", 50) };
}

export function calculateLeveledStat(baseStat, level = 1) {
  return Math.round(baseStat * getStatMultiplier(level));
}

function abilityId(value) {
  const name = typeof value === "string" ? value : value?.name;
  return typeof name === "string"
    ? name.trim().toLowerCase().replaceAll("_", "-").replaceAll(" ", "-") || null
    : null;
}

export function resolvePokemonAbilityId(pokemon) {
  if (!pokemon || pokemon.source === "custom" || pokemon.isCustom)
    return abilityId(pokemon?.abilityId);

  const explicit = abilityId(pokemon.abilityId);
  if (explicit) return explicit;
  const legacy = abilityId(pokemon.ability);
  if (legacy) return legacy;

  const defaultAbility = Array.isArray(pokemon.abilities)
    ? pokemon.abilities.find((entry) => !entry?.is_hidden)?.ability
    : null;
  return abilityId(defaultAbility);
}

export function normalizeCapturedPokemon(pokemon) {
  const current = { ...(pokemon || {}) };
  delete current.held_item;
  delete current.equippedItem;
  delete current.equipped_item;
  const id = current.id ?? current.instanceId ?? current.pokemonId ?? current.speciesId;
  const name = String(current.name || current.displayName || (id ? `Pokémon ${id}` : "Pokémon")).trim() || "Pokémon";
  const equipment = normalizePokemonEquipment(pokemon);
  return {
    ...current,
    id,
    name,
    displayName: String(current.displayName || name),
    types: Array.isArray(current.types) ? current.types.filter(Boolean) : [],
    stats: Array.isArray(current.stats) ? current.stats.filter(Boolean) : [],
    moveset: Array.isArray(current.moveset) ? current.moveset.filter(Boolean).slice(0, 4) : [],
    abilityId: resolvePokemonAbilityId(current),
    level: getPokemonLevel(pokemon),
    baseStats: getBaseStats(pokemon),
    strategicItem: equipment.strategicItem,
    elementalRelic: equipment.elementalRelic,
    heldItem: equipment.strategicItem,
    equipmentVersion: 1,
    saveVersion: 7,
  };
}
