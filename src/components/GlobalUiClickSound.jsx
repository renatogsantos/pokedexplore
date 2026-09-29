"use client";

import { useEffect, useRef } from "react";
import { playUiSound, UI_SOUND } from "@/lib/battle/sound";

const INTERACTIVE_SELECTOR = ["button", "a[href]", "[role='button']", "[role='tab']", "[role='menuitem']", "input:not([type='hidden'])", "select", "summary", "[data-interactive]"].join(",");

function getInteractiveTarget(target) {
  return target instanceof Element ? target.closest(INTERACTIVE_SELECTOR) : null;
}

export default function GlobalUiClickSound() {
  const lastClick = useRef({ target: null, at: 0 });

  useEffect(() => {
    const onClick = (event) => {
      if (!event.isTrusted) return;
      const target = getInteractiveTarget(event.target);
      // BattlePage marks the canonical lifecycle state on its root. Check the
      // document rather than only the clicked subtree so even global controls
      // (for example mobile navigation) remain silent during battle/results.
      if (!target || document.querySelector("[data-battle-context='active']")) return;
      if (target.matches(":disabled") || target.getAttribute("aria-disabled") === "true") return;
      const now = performance.now();
      if (lastClick.current.target === target && now - lastClick.current.at < 40) return;
      lastClick.current = { target, at: now };
      playUiSound(UI_SOUND.CLICK);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
