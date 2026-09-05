import { Crown, Sparkle } from "@phosphor-icons/react";
import { getPokemonRarityPresentation } from "@/lib/pokemon/rarity";

export function getRarityClassName(pokemon) { return getPokemonRarityPresentation(pokemon).className; }

export default function PokemonRarity({ pokemon, compact = false }) {
  const { rarity, label, className } = getPokemonRarityPresentation(pokemon);
  if (rarity === "normal") return null;
  const Icon = rarity === "legendary" ? Crown : Sparkle;
  return <span className={`pokemon-rarity ${className} ${compact ? "is-compact" : ""}`} aria-label={`Pokémon ${label}`}><Icon size={compact ? 13 : 15} weight="fill" aria-hidden="true" /><span>{compact ? label.charAt(0) : label}</span></span>;
}
