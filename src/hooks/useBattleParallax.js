"use client";

import { useEffect, useRef } from "react";

const LAYER_DEPTH = {
  forest: 5,
  light: -7,
  fog: 9,
  particles: 12,
  foreground: 15,
};

const clamp = (value, limit = 1) => Math.max(-limit, Math.min(limit, value));

export default function useBattleParallax(enabled) {
  const arenaRef = useRef(null);

  useEffect(() => {
    const arena = arenaRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!arena || !enabled || reducedMotion.matches) return undefined;

    const layers = Array.from(arena.querySelectorAll("[data-parallax-layer]"));
    const finePointer = window.matchMedia("(pointer: fine)");
    const orientation = window.DeviceOrientationEvent;
    const requiresPermission = typeof orientation?.requestPermission === "function";
    let orientationEnabled = false;
    let permissionRequested = false;
    let motionDisabled = false;
    let isVisible = !document.hidden;
    let frame = 0;
    let baseline = null;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const applyTransforms = () => {
      layers.forEach((layer) => {
        const depth = LAYER_DEPTH[layer.dataset.parallaxLayer] || 0;
        layer.style.transform = `translate3d(${(currentX * depth).toFixed(2)}px, ${(currentY * depth).toFixed(2)}px, 0)`;
      });
    };

    const resetTransforms = () => {
      layers.forEach((layer) => layer.style.removeProperty("transform"));
    };

    const animate = () => {
      frame = 0;
      if (!isVisible || motionDisabled) return;
      currentX += (targetX - currentX) * 0.11;
      currentY += (targetY - currentY) * 0.11;
      applyTransforms();
      if (Math.abs(targetX - currentX) > 0.03 || Math.abs(targetY - currentY) > 0.03) {
        frame = requestAnimationFrame(animate);
      }
    };

    const schedule = () => {
      if (!frame && isVisible && !motionDisabled) frame = requestAnimationFrame(animate);
    };

    const setTarget = (nextX, nextY) => {
      targetX = clamp(nextX);
      targetY = clamp(nextY);
      schedule();
    };

    const onOrientation = ({ beta, gamma }) => {
      if (!isVisible || motionDisabled || !orientationEnabled || !Number.isFinite(beta) || !Number.isFinite(gamma)) return;
      if (!baseline) {
        baseline = { beta, gamma };
        return;
      }
      setTarget((gamma - baseline.gamma) / 16, (beta - baseline.beta) / 18);
    };

    const enableOrientation = () => {
      if (orientationEnabled) return;
      orientationEnabled = true;
      window.addEventListener("deviceorientation", onOrientation, { passive: true });
    };

    const requestOrientationPermission = () => {
      if (!requiresPermission || permissionRequested) return;
      permissionRequested = true;
      orientation
        .requestPermission()
        .then((permission) => {
          if (permission === "granted") enableOrientation();
        })
        .catch(() => {});
    };

    const onPointerMove = (event) => {
      if (!isVisible || motionDisabled || !finePointer.matches) return;
      const bounds = arena.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - 0.5;
      const y = (event.clientY - bounds.top) / bounds.height - 0.5;
      setTarget(x * 1.55, y * 1.3);
    };

    const onPointerLeave = () => setTarget(0, 0);
    const onVisibilityChange = () => {
      isVisible = !document.hidden;
      if (!isVisible && frame) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      if (!isVisible) baseline = null;
      if (isVisible) schedule();
    };
    const onOrientationChange = () => {
      baseline = null;
      setTarget(0, 0);
    };
    const onReducedMotionChange = ({ matches }) => {
      if (!matches) return;
      motionDisabled = true;
      targetX = 0;
      targetY = 0;
      currentX = 0;
      currentY = 0;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      resetTransforms();
    };

    if (!requiresPermission && orientation) enableOrientation();
    arena.addEventListener("pointerdown", requestOrientationPermission, { once: true, passive: true });
    arena.addEventListener("pointermove", onPointerMove, { passive: true });
    arena.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("orientationchange", onOrientationChange, { passive: true });
    reducedMotion.addEventListener?.("change", onReducedMotionChange);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (orientationEnabled) window.removeEventListener("deviceorientation", onOrientation);
      arena.removeEventListener("pointerdown", requestOrientationPermission);
      arena.removeEventListener("pointermove", onPointerMove);
      arena.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("orientationchange", onOrientationChange);
      reducedMotion.removeEventListener?.("change", onReducedMotionChange);
      resetTransforms();
    };
  }, [enabled]);

  return arenaRef;
}
