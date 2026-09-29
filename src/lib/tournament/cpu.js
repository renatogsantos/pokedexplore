import { TOURNAMENT_MATCH_KIND } from "./match.js";

export function isValidTournamentCpuTeam(team) {
  return Array.isArray(team) && team.length === 3 && team.every((pokemon) =>
    pokemon && (pokemon.id || pokemon.pokemonId || pokemon.speciesId) && (pokemon.name || pokemon.species?.name),
  );
}

export async function prepareTournamentCpuOpponent({ match, matchKind, generateTeam, freezeTeam }) {
  if (matchKind !== TOURNAMENT_MATCH_KIND.HUMAN_VS_CPU) throw new Error("A partida não possui oponente CPU.");
  if (isValidTournamentCpuTeam(match?.cpu_team)) return { status: "READY", team: match.cpu_team, source: "persisted" };
  const generatedTeam = await generateTeam();
  if (!isValidTournamentCpuTeam(generatedTeam)) throw new Error("A equipe gerada da CPU é inválida.");
  const frozenTeam = await freezeTeam(generatedTeam);
  if (!isValidTournamentCpuTeam(frozenTeam)) throw new Error("Não foi possível persistir a equipe da CPU.");
  return { status: "READY", team: frozenTeam, source: "generated" };
}
