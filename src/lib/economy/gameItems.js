import { TM_CATALOG } from "@/lib/battle/tms";
import { ITEM_CATALOG, getItemDefinition } from "@/lib/items/catalog";

// These are deliberately small, explicit rules owned by PokédExplore.  The
// inventory stores only ids, so prices and descriptions stay consistent in
// every screen that presents an item.
export const GAME_ITEM_CATALOG = Object.freeze([
  ...ITEM_CATALOG,
]);

export const SHOP_UPGRADES = Object.freeze([
  ...GAME_ITEM_CATALOG,
  ...TM_CATALOG.map((tm) => ({ ...tm, category: "tm", description: `${tm.power} de poder · ${tm.damageClass === "physical" ? "Físico" : "Especial"}`, quantityLabel: "TM permanente" })),
]);

export function getShopUpgrade(id) {
  return getItemDefinition(id) || SHOP_UPGRADES.find((upgrade) => upgrade.id === id) || null;
}
