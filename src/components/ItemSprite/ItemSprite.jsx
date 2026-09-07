"use client";

import { Package } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getItemSprite, loadItemVisual } from "@/lib/items/visuals";
import styles from "./ItemSprite.module.scss";

export default function ItemSprite({ item, alt = "", className = "" }) {
  const [sprite, setSprite] = useState(() => getItemSprite(item));
  const [failed, setFailed] = useState(false);
  useEffect(() => { let active = true; setFailed(false); setSprite(getItemSprite(item)); void loadItemVisual(item).then((visual) => active && setSprite(visual?.sprite || null)); return () => { active = false; }; }, [item]);
  if (!sprite || failed) return <span className={`${styles.fallback} ${className}`} aria-label={alt || "Item"}><Package size={18} weight="fill" aria-hidden="true" /></span>;
  return <img className={`${styles.sprite} ${className}`} src={sprite} alt={alt} onError={() => setFailed(true)} loading="lazy" />;
}
