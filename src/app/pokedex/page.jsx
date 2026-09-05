import PokedexExplorer from "./PokedexExplorer";
import "./style.scss";

export const metadata = {
  title: "Pokédex | PokédExplore",
  description: "Sua coleção de Pokémon capturados no PokédExplore.",
};

export default function PokedexPage() {
  return <PokedexExplorer />;
}
