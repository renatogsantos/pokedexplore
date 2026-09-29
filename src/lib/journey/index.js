import { ITEM_CATALOG } from "../items/catalog.js";

export const JOURNEY_MEDALS = Object.freeze([
  { id: "medalha-das-mares", name: "Medalha das Marés", routeId: "water-gym", icon: "water" },
  { id: "medalha-da-montanha", name: "Medalha da Montanha", routeId: "stone-gym", icon: "rock" },
  { id: "medalha-das-chamas", name: "Medalha das Chamas", routeId: "summit-gym", icon: "fire" },
]);

const createBattles = (team, level, tier) => Object.freeze([
  { index: 1, kind: "encounter", label: "ENCONTRO", difficulty: tier > 2 ? "normal" : "easy", coins: 10 + tier * 6, team: team.map((id) => ({ id, level })) },
  { index: 2, kind: "elite", label: "ELITE", difficulty: "normal", coins: 15 + tier * 8, team: team.map((id, index) => ({ id, level: Math.min(10, level + (index === 2 ? 1 : 0)) })) },
  { index: 3, kind: "boss", label: "CHEFE DA ROTA", difficulty: "hard", coins: 24 + tier * 12, team: team.map((id, index) => ({ id, level: Math.min(10, level + 1 + Number(index === 2)) })) },
]);
const route = (definition) => Object.freeze({ ...definition, battles: createBattles(definition.team, definition.level, definition.tier) });

// Curated static teams establish difficulty through real species, levels and
// the canonical CPU AI. Journey never adds a damage or stat multiplier.
export const JOURNEY_ROUTES = Object.freeze([
  route({ id: "route-1", chapter: 1, title: "Rota 1", subtitle: "Primeiros passos", theme: "Campos de Broto", tier: 1, level: 1, team: [19, 1, 4] }),
  route({ id: "route-2", chapter: 1, title: "Rota 2", subtitle: "Tipos em ação", theme: "Vale dos Ventos", tier: 1, level: 2, team: [19, 7, 25] }),
  route({ id: "water-gym", chapter: 1, title: "Ginásio Água", subtitle: "Líder Marina", theme: "Ginásio das Marés", tier: 2, level: 3, team: [54, 7, 25], medalId: "medalha-das-mares" }),
  route({ id: "canyon-trail", chapter: 2, title: "Trilha do Cânion", subtitle: "Defesas resistentes", theme: "Terras Selvagens", tier: 2, level: 4, team: [27, 74, 41] }),
  route({ id: "thunder-route", chapter: 2, title: "Rota da Tempestade", subtitle: "Velocidade e pressão", theme: "Terras Selvagens", tier: 2, level: 5, team: [25, 41, 54] }),
  route({ id: "stone-gym", chapter: 2, title: "Ginásio Pedra", subtitle: "Líder Bruno", theme: "Ginásio da Montanha", tier: 3, level: 6, team: [74, 95, 27], medalId: "medalha-da-montanha" }),
  route({ id: "tower-path", chapter: 3, title: "Torre Nebulosa", subtitle: "Táticas especiais", theme: "Céus em Chamas", tier: 3, level: 7, team: [92, 41, 25] }),
  route({ id: "champion-road", chapter: 3, title: "Estrada do Campeão", subtitle: "Equipe equilibrada", theme: "Céus em Chamas", tier: 3, level: 8, team: [66, 54, 4] }),
  route({ id: "summit-gym", chapter: 3, title: "Ginásio do Cume", subtitle: "Líder Orion", theme: "Ginásio das Chamas", tier: 4, level: 9, team: [95, 92, 66], medalId: "medalha-das-chamas" }),
  route({ id: "champion-challenge", chapter: 4, title: "Desafio dos Campeões", subtitle: "A prova final da Jornada", theme: "Coroa da Jornada", tier: 5, level: 10, team: [95, 66, 92], champion: true }),
]);
export const JOURNEY_CHAPTERS = Object.freeze([
  { id: 1, title: "Primeiros Passos", routeIds: ["route-1", "route-2", "water-gym"] },
  { id: 2, title: "Terras Selvagens", routeIds: ["canyon-trail", "thunder-route", "stone-gym"] },
  { id: 3, title: "Céus em Chamas", routeIds: ["tower-path", "champion-road", "summit-gym"] },
  { id: 4, title: "Coroa da Jornada", routeIds: ["champion-challenge"] },
]);
export const JOURNEY_NODES = JOURNEY_ROUTES; // compatible legacy export
export const JOURNEY_REPLAY_MULTIPLIER = 0.45;
export const JOURNEY_PERFECT_BONUS = Object.freeze({ coins: 35, itemRarity: "RARE" });

export function getJourneyNode(id) { return JOURNEY_ROUTES.find((routeItem) => routeItem.id === id) || null; }
export const getJourneyRoute = getJourneyNode;
export function getJourneyBattle(routeId, battleIndex) { return getJourneyRoute(routeId)?.battles?.[Number(battleIndex) - 1] || null; }
export function isJourneyNodeUnlocked(nodeId, completed = [], medals = []) {
  const index = JOURNEY_ROUTES.findIndex((routeItem) => routeItem.id === nodeId);
  if (index < 0) return false;
  if (JOURNEY_ROUTES[index].champion) return JOURNEY_MEDALS.every((medal) => medals.includes(medal.id));
  return index === 0 || completed.includes(JOURNEY_ROUTES[index - 1].id);
}
const hash = (value) => [...String(value)].reduce((total, char) => ((total * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
const itemFor = (seed, rarity) => {
  const pool = ITEM_CATALOG.filter((item) => item.rarity === rarity);
  return pool.length ? pool[hash(`${seed}:${rarity}`) % pool.length].id : null;
};
export function resolveJourneyLoot({ route, battleIndex, runId, firstClear, chest = false, perfect = false }) {
  const boss = Number(battleIndex) === 3;
  const rarity = chest ? (route.tier >= 4 ? "LEGENDARY" : route.tier >= 2 ? "EPIC" : "RARE") : boss ? (route.tier >= 3 ? "EPIC" : "RARE") : Number(battleIndex) === 2 ? "RARE" : "COMMON";
  const baseCoins = chest ? 45 + route.tier * 20 : route.battles[Number(battleIndex) - 1].coins;
  const coins = Math.round(baseCoins * (firstClear ? 1 : JOURNEY_REPLAY_MULTIPLIER)) + (perfect ? JOURNEY_PERFECT_BONUS.coins : 0);
  return { id: `journey:${runId}:${route.id}:${battleIndex}:${chest ? "chest" : "battle"}`, coins, itemId: itemFor(`${runId}:${route.id}:${battleIndex}:${chest}`, perfect ? JOURNEY_PERFECT_BONUS.itemRarity : rarity), rarity, chest, perfect };
}
export function buildJourneyCpuTeam(routeId, battleIndex, roster = []) {
  const battle = getJourneyBattle(routeId, battleIndex);
  return (battle?.team || []).map((entry) => {
    const pokemon = roster.find((candidate) => candidate.id === entry.id) || roster[0];
    if (!pokemon) return null;
    return { ...pokemon, types: [...pokemon.types], baseStats: { ...pokemon.baseStats }, level: entry.level };
  }).filter(Boolean);
}
export function getJourneyRoundSound(battleIndex) { return ({ 1: "round-one", 2: "round-two", 3: "final-round" })[Number(battleIndex)] || null; }
