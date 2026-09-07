"use client";

import { Sword } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function shouldShowGlobalBattleButton(pathname) {
  return Boolean(pathname) && !pathname.startsWith("/batalha");
}

export default function GlobalBattleButton() {
  const pathname = usePathname();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const isVisible = shouldShowGlobalBattleButton(pathname);

  useEffect(() => {
    setIsNavigating(false);
  }, [pathname]);

  if (!isVisible) return null;

  function handleBattleNavigation() {
    if (isNavigating) return;

    setIsNavigating(true);
    router.push("/batalha");
  }

  return (
    <button
      type="button"
      className="global-battle-button"
      onClick={handleBattleNavigation}
      disabled={isNavigating}
      aria-label="Ir para Batalhas"
    >
      <Sword size={20} weight="fill" aria-hidden="true" />
      <span>{isNavigating ? "Abrindo..." : "Batalhar"}</span>
    </button>
  );
}
