const COLORS = {
  capture: ["#ffcb05", "#4aa8ff", "#f05b66", "#ffffff"],
  purchase: ["#ffcb05", "#ffe274", "#ffffff", "#4aa8ff"],
  victory: ["#ffcb05", "#ffe274", "#4aa8ff", "#ffffff", "#ef646b"],
  legendary: ["#ffcb05", "#ffe77a", "#fff7cf", "#ffffff"],
  mythical: ["#d68cff", "#ff8fcf", "#73ddff", "#ffffff"],
};

let confettiLoader;

function getOrigin(element) {
  if (typeof window === "undefined" || !element?.getBoundingClientRect) return { x: 0.5, y: 0.5 };
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return { x: 0.5, y: 0.5 };
  return {
    x: Math.min(0.92, Math.max(0.08, (rect.left + rect.width / 2) / window.innerWidth)),
    y: Math.min(0.86, Math.max(0.12, (rect.top + rect.height / 2) / window.innerHeight)),
  };
}

async function fire(options) {
  if (typeof window === "undefined") return;
  confettiLoader ||= import("canvas-confetti").then((module) => module.default);
  const confetti = await confettiLoader;
  return confetti({ disableForReducedMotion: true, useWorker: true, zIndex: 50, ...options });
}

function later(callback, delay) {
  if (typeof window !== "undefined") window.setTimeout(callback, delay);
}

export function celebratePokemonCapture({ rarity = "normal", element } = {}) {
  const origin = getOrigin(element);
  if (rarity === "legendary") {
    void fire({ particleCount: 95, spread: 76, startVelocity: 39, origin, colors: COLORS.legendary, shapes: ["star", "circle"] });
    later(() => void fire({ particleCount: 38, spread: 58, startVelocity: 28, origin, colors: COLORS.legendary, shapes: ["star"] }), 230);
    return;
  }
  if (rarity === "mythical") {
    void fire({ particleCount: 90, spread: 78, startVelocity: 36, origin, colors: COLORS.mythical, shapes: ["star", "circle"] });
    later(() => void fire({ particleCount: 34, spread: 52, startVelocity: 25, origin, colors: COLORS.mythical, shapes: ["circle"] }), 220);
    return;
  }
  void fire({ particleCount: 66, spread: 66, startVelocity: 34, origin, colors: COLORS.capture, scalar: 0.88 });
}

export function celebratePokemonPurchase({ rarity = "normal" } = {}) {
  const colors = rarity === "legendary" ? COLORS.legendary : rarity === "mythical" ? COLORS.mythical : COLORS.purchase;
  const shapes = rarity === "normal" ? ["square", "circle"] : ["star", "circle"];
  void fire({ particleCount: 52, angle: 58, spread: 52, startVelocity: 34, origin: { x: 0.04, y: 0.72 }, colors, shapes, scalar: 0.92 });
  later(() => void fire({ particleCount: 52, angle: 122, spread: 52, startVelocity: 34, origin: { x: 0.96, y: 0.72 }, colors, shapes, scalar: 0.92 }), 110);
}

export function celebrateBattleVictory() {
  const resultModalZIndex = 130;
  void fire({ particleCount: 96, spread: 96, startVelocity: 44, origin: { x: 0.5, y: 0.58 }, colors: COLORS.victory, shapes: ["square", "circle", "star"], zIndex: resultModalZIndex });
  later(() => void fire({ particleCount: 46, angle: 58, spread: 58, startVelocity: 38, origin: { x: 0.03, y: 0.68 }, colors: COLORS.victory, scalar: 0.92, zIndex: resultModalZIndex }), 180);
  later(() => void fire({ particleCount: 46, angle: 122, spread: 58, startVelocity: 38, origin: { x: 0.97, y: 0.68 }, colors: COLORS.victory, scalar: 0.92, zIndex: resultModalZIndex }), 220);
  later(() => void fire({ particleCount: 40, spread: 110, startVelocity: 18, gravity: 0.72, ticks: 120, origin: { x: 0.5, y: 0.24 }, colors: COLORS.victory, scalar: 0.78, zIndex: resultModalZIndex }), 520);
}
