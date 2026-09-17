import { CPU_ROSTER } from "@/lib/battle/pokemon";

const TYPE_LEADER_IDS = Object.freeze({
  normal: 19,
  fire: 4,
  water: 7,
  electric: 25,
  grass: 1,
  ice: 361,
  fighting: 66,
  poison: 41,
  ground: 27,
  flying: 16,
  psychic: 63,
  bug: 10,
  rock: 74,
  ghost: 92,
  dragon: 147,
  dark: 261,
  steel: 304,
  fairy: 35,
});

const COVERAGE_IDS = [25, 7, 1, 4, 66, 92, 27, 304];

export function getBadgeCpuTeam(type, battleNumber = 1) {
  const leader = CPU_ROSTER.find((pokemon) => pokemon.id === TYPE_LEADER_IDS[type]) || CPU_ROSTER[0];
  const coverage = COVERAGE_IDS
    .map((id) => CPU_ROSTER.find((pokemon) => pokemon.id === id))
    .filter((pokemon) => pokemon && pokemon.id !== leader.id);
  const offset = Math.max(0, Number(battleNumber) - 1) % coverage.length;
  const selected = [leader, coverage[offset], coverage[(offset + 3) % coverage.length]];
  const level = Math.min(9, 5 + Math.max(0, Number(battleNumber) - 1));
  return selected.map((pokemon) => ({ ...pokemon, level }));
}

