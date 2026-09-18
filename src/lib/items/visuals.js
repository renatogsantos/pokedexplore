import { getItemImage } from "@/lib/items/catalog";

export function normalizeItemId(item) {
  return String(item || "").trim().toLowerCase();
}

export function getItemSprite(item) {
  return getItemImage(normalizeItemId(item));
}

export async function loadItemVisual(item) {
  const id = normalizeItemId(item);
  const sprite = getItemSprite(id);
  return sprite ? { id, sprite } : null;
}

export function preloadItemVisuals(items) {
  return Promise.resolve((items || []).map((id) => ({ id, sprite: getItemSprite(id) })).filter((entry) => entry.sprite));
}
