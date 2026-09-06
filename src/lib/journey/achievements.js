export const ACHIEVEMENTS = Object.freeze([
  { id: "primeira-vitoria", name: "Primeira vitória", description: "Vença sua primeira batalha.", reward: 10, icon: "trophy" },
  { id: "velocista", name: "Velocista", description: "Vença uma batalha em menos de 1 minuto.", reward: 15, icon: "lightning" },
  { id: "exercito-de-um", name: "Exército de um", description: "Vença sem trocar de Pokémon.", reward: 30, icon: "shield" },
  { id: "imparavel", name: "Imparável", description: "Alcance uma sequência de 5 vitórias.", reward: 40, icon: "fire" },
]);

export const getAchievement = (id) => ACHIEVEMENTS.find((achievement) => achievement.id === id) || null;
