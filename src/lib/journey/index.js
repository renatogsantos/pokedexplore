export const JOURNEY_NODES = Object.freeze([
  { id: "route-1", title: "Rota 1", subtitle: "Primeiros passos", reward: 20, level: 1, team: [{ id: 19, level: 1 }, { id: 1, level: 1 }, { id: 4, level: 1 }] },
  { id: "route-2", title: "Rota 2", subtitle: "Tipos em ação", reward: 30, level: 2, team: [{ id: 19, level: 2 }, { id: 7, level: 2 }, { id: 25, level: 2 }] },
  { id: "water-gym", title: "Ginásio Água", subtitle: "Líder Marina", reward: 100, badge: "Insígnia Aqua", level: 3, team: [{ id: 54, level: 3 }, { id: 7, level: 3 }, { id: 7, level: 4 }] },
  { id: "canyon-trail", title: "Trilha do Cânion", subtitle: "Defesas resistentes", reward: 45, level: 4, team: [{ id: 27, level: 4 }, { id: 74, level: 4 }, { id: 41, level: 4 }] },
  { id: "thunder-route", title: "Rota da Tempestade", subtitle: "Velocidade e pressão", reward: 55, level: 5, team: [{ id: 25, level: 5 }, { id: 41, level: 5 }, { id: 54, level: 5 }] },
  { id: "stone-gym", title: "Ginásio Pedra", subtitle: "Líder Bruno", reward: 140, badge: "Insígnia Rocha", level: 6, team: [{ id: 74, level: 6 }, { id: 95, level: 6 }, { id: 27, level: 6 }] },
  { id: "tower-path", title: "Torre Nebulosa", subtitle: "Táticas especiais", reward: 70, level: 7, team: [{ id: 92, level: 7 }, { id: 41, level: 7 }, { id: 25, level: 7 }] },
  { id: "champion-road", title: "Estrada do Campeão", subtitle: "Equipe equilibrada", reward: 85, level: 8, team: [{ id: 66, level: 8 }, { id: 54, level: 8 }, { id: 4, level: 8 }] },
  { id: "summit-gym", title: "Ginásio do Cume", subtitle: "Líder Orion", reward: 220, badge: "Insígnia Cume", level: 10, team: [{ id: 95, level: 9 }, { id: 92, level: 9 }, { id: 66, level: 10 }] },
]);

export function getJourneyNode(nodeId) {
  return JOURNEY_NODES.find((node) => node.id === nodeId) || null;
}

export function isJourneyNodeUnlocked(nodeId, completed = []) {
  const index = JOURNEY_NODES.findIndex((node) => node.id === nodeId);
  return index === 0 || (index > 0 && completed.includes(JOURNEY_NODES[index - 1].id));
}
