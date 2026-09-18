import { Fire, Lightning, MoonStars, Skull } from "@phosphor-icons/react";
import { getStatusDefinition } from "@/lib/battle/statuses";

const ICONS = Object.freeze({
  lightning: Lightning,
  moon: MoonStars,
  fire: Fire,
  skull: Skull,
});

export default function StatusIcon({ status, size = 16, decorative = true, ...props }) {
  const definition = getStatusDefinition(status);
  const Icon = ICONS[definition?.icon] || Lightning;
  return (
    <Icon
      size={size}
      weight="fill"
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : definition?.displayName || "Condição de batalha"}
      {...props}
    />
  );
}
