import { TM_CATALOG } from "@/lib/battle/tms";

// These are deliberately small, explicit rules owned by PokédExplore.  The
// inventory stores only ids, so prices and descriptions stay consistent in
// every screen that presents an item.
export const GAME_ITEM_CATALOG = Object.freeze([
  { id: "potion", name: "Poção", description: "Recupera 40% do HP de um Pokémon na batalha.", price: 35, category: "battle", quantityLabel: "na Mochila" },
  { id: "full-heal", name: "Purificação", description: "Remove queimadura, veneno, paralisia ou sono.", price: 70, category: "battle", quantityLabel: "na Mochila" },
  { id: "oran", name: "Berry Oran", description: "Quando o HP cai pela metade, recupera 20% automaticamente.", price: 45, category: "held", quantityLabel: "disponível" },
  { id: "sitrus", name: "Berry Sitrus", description: "Quando o HP cai pela metade, recupera 30% automaticamente.", price: 80, category: "held", quantityLabel: "disponível" },
  { id: "type-boost", name: "Amplificador de tipo", description: "Aumenta em 10% os golpes do tipo principal do Pokémon equipado.", price: 120, category: "held", quantityLabel: "disponível" },
]);

export const SHOP_UPGRADES = Object.freeze([
  ...GAME_ITEM_CATALOG,
  ...TM_CATALOG.map((tm) => ({ ...tm, category: "tm", description: `${tm.power} de poder · ${tm.damageClass === "physical" ? "Físico" : "Especial"}`, quantityLabel: "TM permanente" })),
]);

export function getShopUpgrade(id) {
  return SHOP_UPGRADES.find((upgrade) => upgrade.id === id) || null;
}
