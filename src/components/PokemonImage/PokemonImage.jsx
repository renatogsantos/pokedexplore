"use client";

import { useMemo, useState } from "react";
import { getPokemonSpriteCandidates, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";

export default function PokemonImage({ pokemon, context = SPRITE_CONTEXT.GENERAL, side = null, className, alt = "", ImageComponent = "img", ...imageProps }) {
  const candidates = useMemo(() => getPokemonSpriteCandidates({ pokemon, context, side }), [pokemon, context, side]);
  const identity = `${pokemon?.instanceId || pokemon?.id || pokemon?.customId || pokemon?.name || "unknown"}:${context}:${side || ""}:${candidates.map((candidate) => candidate.src).join("|")}`;
  const [state, setState] = useState({ identity, index: 0, exhausted: false });
  const index = state.identity === identity ? state.index : 0;
  const exhausted = state.identity === identity && state.exhausted;
  const candidate = candidates[index] || candidates.at(-1);

  if (exhausted || !candidate) return <span className={`${className || ""} pokemon-image-fallback`} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} />;

  const onError = () => {
    const nextIndex = index + 1;
    if (process.env.NODE_ENV === "development") console.warn("[PokemonImage]", { pokemon: pokemon?.name || pokemon?.id, context, failedSource: candidate.source, fallbackSource: candidates[nextIndex]?.source || "local-placeholder" });
    setState({ identity, index: nextIndex, exhausted: nextIndex >= candidates.length });
  };
  return <ImageComponent className={className} src={candidate.src} alt={alt} onError={onError} data-image-source={process.env.NODE_ENV === "development" ? candidate.source : undefined} {...imageProps} />;
}
