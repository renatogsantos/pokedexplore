export const JOURNEY_NODES = Object.freeze([
  { id: "route-1", title: "Rota 1", subtitle: "Primeiros passos", reward: 20, team: [7, 1, 4] },
  { id: "route-2", title: "Rota 2", subtitle: "Tipos em ação", reward: 30, team: [4, 7, 1] },
  { id: "water-gym", title: "Ginásio Water", subtitle: "Líder Marina", reward: 100, badge: "Aqua Badge", team: [7, 7, 7] },
]);

export function getJourneyNode(nodeId) {
  return JOURNEY_NODES.find((node) => node.id === nodeId) || null;
}

export function isJourneyNodeUnlocked(nodeId, completed = []) {
  const index = JOURNEY_NODES.findIndex((node) => node.id === nodeId);
  return index === 0 || (index > 0 && completed.includes(JOURNEY_NODES[index - 1].id));
}
