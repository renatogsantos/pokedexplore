"use client";

import { UserCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getPlayerAvatar } from "@/lib/profile/avatars";

export default function PlayerAvatar({ avatarId, className = "", eager = false }) {
  const avatar = getPlayerAvatar(avatarId);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [avatar.image]);

  return (
    <span
      className={`player-avatar ${className}`.trim()}
      data-avatar-id={avatar.id}
      aria-hidden="true"
    >
      {!failed ? (
        <img
          src={avatar.image}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <UserCircle className="player-avatar__fallback" weight="duotone" />
      )}
    </span>
  );
}
