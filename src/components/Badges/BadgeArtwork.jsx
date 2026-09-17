"use client";

import { useEffect, useState } from "react";
import { getBadgeConfig } from "@/lib/badges/config";

export default function BadgeArtwork({ badge, className = "", decorative = false }) {
  const config = getBadgeConfig(badge?.code || badge?.type || badge);
  const [source, setSource] = useState(config?.image);
  useEffect(() => { setSource(config?.image); }, [config?.image]);
  if (!config) return null;
  return (
    <span className={`competitive-badge-artwork ${className}`} style={{ "--badge-color": config.color }}>
      <img
        src={source || config.fallbackImage}
        alt={decorative ? "" : config.name}
        aria-hidden={decorative || undefined}
        onError={() => setSource(config.fallbackImage)}
      />
    </span>
  );
}

