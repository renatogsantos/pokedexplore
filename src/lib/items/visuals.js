import { webStore } from "@/helpers/webStore";

const ITEM_ALIASES = Object.freeze({ oran: "oran-berry", sitrus: "sitrus-berry", potion: "potion", "full-heal": "full-heal" });
const memory = new Map();
const pending = new Map();

export function normalizeItemId(item) {
  const value = String(item || "").toLowerCase();
  return ITEM_ALIASES[value] || value;
}

export function getItemSprite(item) {
  return memory.get(normalizeItemId(item))?.sprite || null;
}

export async function loadItemVisual(item) {
  const id = normalizeItemId(item);
  if (!id || id === "type-boost") return null;
  if (memory.has(id)) return memory.get(id);
  if (pending.has(id)) return pending.get(id);
  const request = (async () => {
    const cacheKey = `item:${id}`;
    const cached = await webStore.getCachedResource(cacheKey);
    if (cached?.sprite) { memory.set(id, cached); return cached; }
    const response = await fetch(`https://pokeapi.co/api/v2/item/${encodeURIComponent(id)}`);
    if (!response.ok) throw new Error("item-not-found");
    const data = await response.json();
    const visual = { id: data.id, name: data.name, displayName: data.names?.find((entry) => entry.language.name === "en")?.name || data.name, category: data.category?.name || null, sprite: data.sprites?.default || null };
    memory.set(id, visual);
    void webStore.setCachedResource(cacheKey, visual);
    return visual;
  })().catch(() => null).finally(() => pending.delete(id));
  pending.set(id, request);
  return request;
}

export function preloadItemVisuals(items) {
  return Promise.all((items || []).map(loadItemVisual));
}
