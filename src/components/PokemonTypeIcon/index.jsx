"use client";

const TYPE_LABELS = {
  electric: "Electric",
  grass: "Grass",
  fire: "Fire",
  water: "Water",
  normal: "Normal",
  fighting: "Fighting",
  flying: "Flying",
  poison: "Poison",
  ground: "Ground",
  rock: "Rock",
  bug: "Bug",
  ghost: "Ghost",
  steel: "Steel",
  psychic: "Psychic",
  ice: "Ice",
  dragon: "Dragon",
  dark: "Dark",
  fairy: "Fairy",
};

export default function PokemonTypeIcon({
  type,
  size = 28,
  className = "",
  label,
  decorative = false,
  interactive = false,
}) {
  if (!type) return null;

  const normalizedType = String(type).toLowerCase();
  const accessibleLabel = label || TYPE_LABELS[normalizedType] || normalizedType;

  return (
    <img
      className={`pokemon-type-icon ${className}`.trim()}
      src={`/types/${normalizedType}.svg`}
      alt={decorative ? "" : accessibleLabel}
      aria-label={decorative ? undefined : accessibleLabel}
      title={decorative ? undefined : accessibleLabel}
      aria-hidden={decorative ? "true" : undefined}
      tabIndex={!decorative && interactive ? 0 : undefined}
      width={size}
      height={size}
      draggable={false}
      loading="lazy"
    />
  );
}
