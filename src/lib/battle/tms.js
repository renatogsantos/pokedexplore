export const MAX_BATTLE_MOVES = 4;

// PokédExplore owns the simplified rules; these are intentionally supported,
// deterministic TM definitions rather than a partial simulation of all PokéAPI moves.
export const TM_CATALOG = Object.freeze([
  { id: "tm-thunderbolt", name: "Thunderbolt", type: "electric", power: 90, accuracy: 100, damageClass: "special", price: 300 },
  { id: "tm-flamethrower", name: "Flamethrower", type: "fire", power: 90, accuracy: 100, damageClass: "special", price: 300 },
  { id: "tm-ice-beam", name: "Ice Beam", type: "ice", power: 90, accuracy: 100, damageClass: "special", price: 300 },
  { id: "tm-psychic", name: "Psychic", type: "psychic", power: 90, accuracy: 100, damageClass: "special", price: 300 },
  { id: "tm-earthquake", name: "Earthquake", type: "ground", power: 100, accuracy: 100, damageClass: "physical", price: 360 },
]);

export function getCompatibleTms(pokemon) {
  const types = (pokemon?.types || []).map((entry) => typeof entry === "string" ? entry : entry.type?.name).filter(Boolean);
  return TM_CATALOG.filter((tm) => types.includes(tm.type));
}
