import { TM_CATALOG } from "@/lib/battle/tms";
import { HELD_ITEM_CATALOG } from "@/lib/economy/heldItems";

// These are deliberately small, explicit rules owned by PokédExplore.  The
// inventory stores only ids, so prices and descriptions stay consistent in
// every screen that presents an item.
export const GAME_ITEM_CATALOG = Object.freeze([
  { id: "potion", name: "Poção", description: "Recupera 40% do HP de um Pokémon na batalha.", price: 35, category: "battle", quantityLabel: "na Mochila" },
  { id: "full-heal", name: "Purificação", description: "Remove queimadura, veneno, paralisia ou sono.", price: 70, category: "battle", quantityLabel: "na Mochila" },
  ...HELD_ITEM_CATALOG,
]);

export const SHOP_UPGRADES = Object.freeze([
  ...GAME_ITEM_CATALOG,
  ...TM_CATALOG.map((tm) => ({ ...tm, category: "tm", description: `${tm.power} de poder · ${tm.damageClass === "physical" ? "Físico" : "Especial"}`, quantityLabel: "TM permanente" })),
]);

export function getShopUpgrade(id) {
  return SHOP_UPGRADES.find((upgrade) => upgrade.id === id) || null;
}
