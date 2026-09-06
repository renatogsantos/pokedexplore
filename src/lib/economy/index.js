import { getPokemonRarity, POKEMON_RARITY } from "@/lib/pokemon/rarity";
import { COINS_PER_WIN } from "../battle/rewards";

export { COINS_PER_WIN };

export const formatCoins = (value) => new Intl.NumberFormat("pt-BR").format(Math.max(0, Number(value) || 0));

const roundToVictory = (value) => Math.ceil(value / COINS_PER_WIN) * COINS_PER_WIN;

export function getPokemonBaseStatTotal(pokemon) {
  return (pokemon?.stats || []).reduce((total, stat) => total + (Number(stat?.base_stat) || 0), 0);
}

export function getPokemonPrice(pokemon) {
  const bst = getPokemonBaseStatTotal(pokemon);
  const baseExperience = Number(pokemon?.base_experience) || 0;
  const rarity = getPokemonRarity(pokemon);

  if (rarity === POKEMON_RARITY.MYTHICAL) {
    return roundToVictory(Math.max(750, 750 + Math.max(0, bst - 520) * 1.1 + Math.max(0, baseExperience - 180) * 0.25));
  }
  if (rarity === POKEMON_RARITY.LEGENDARY) {
    return roundToVictory(Math.max(450, 450 + Math.max(0, bst - 500) * 0.85 + Math.max(0, baseExperience - 180) * 0.2));
  }

  const strengthPrice = bst <= 310 ? 45 : bst <= 400 ? 60 : bst <= 500 ? 90 : bst <= 560 ? 165 : 270;
  const experienceBonus = baseExperience >= 230 ? 15 : 0;
  return roundToVictory(strengthPrice + experienceBonus);
}

export function getPurchaseLabel({ balance, price, level, maxLevel }) {
  if (maxLevel || level >= 10) return "Nível máximo";
  if (balance < price) return `Faltam ${price - balance} moedas`;
  return level > 0 ? "Comprar + nível" : "Comprar";
}
