import { webStore } from "@/helpers/webStore";
import { hasBadgeServiceConfig, listBadges } from "@/lib/badges/service";
import { getHeldItemStock } from "@/lib/economy/heldItems";
import { ITEM_CATALOG } from "@/lib/items/catalog";
import { getShopCatalog } from "@/lib/pokemon/shopCatalog";
import { getTotalXpForTrainerLevel } from "@/lib/profile/progression";
import { getPlayerActiveTournament } from "@/lib/tournament/service";

export async function loadCreatorLocalState() {
  const [profile, economy, collection, decks, storage] = await Promise.all([
    webStore.getLocalPlayerProfile(),
    webStore.getEconomy(),
    webStore.getData("Pokedex"),
    webStore.getDecks(),
    webStore.getStorageSnapshot(),
  ]);
  return { profile, economy, collection, decks, storage };
}

export async function loadCreatorPokemonCatalog() {
  return getShopCatalog();
}

export async function loadCreatorSharedState(playerId) {
  if (!hasBadgeServiceConfig()) {
    return { configured: false, badges: [], activeChallenge: null, tournament: null, error: "Supabase não configurado neste ambiente." };
  }
  try {
    const [badges, tournament] = await Promise.all([
      listBadges(),
      getPlayerActiveTournament(playerId).catch(() => null),
    ]);
    return {
      configured: true,
      badges,
      activeChallenge: badges.find((badge) => badge.activeChallenge)?.activeChallenge || null,
      tournament,
      error: "",
    };
  } catch (error) {
    return { configured: true, badges: [], activeChallenge: null, tournament: null, error: error?.message || "Não foi possível ler o estado compartilhado." };
  }
}

export async function creatorChangeCoins(operation, value = 0) {
  const economy = await webStore.getEconomy();
  const amount = Math.max(0, Math.floor(Number(value) || 0));
  const next = operation === "set"
    ? amount
    : operation === "remove"
      ? Math.max(0, economy.coins - amount)
      : economy.coins + amount;
  return webStore.setCoinBalance(next);
}

export function creatorSetInfiniteCoins(enabled) {
  return webStore.setInfiniteCoins(enabled);
}

export function creatorSetPokemonLevel(pokemonId, level) {
  return webStore.setPokemonLevel(pokemonId, level);
}

export function creatorRemovePokemon(pokemonId) {
  return webStore.removePokemon(pokemonId);
}

export function creatorAddPokemon(pokemon, level = 1) {
  return webStore.upsertPokemonCollection([pokemon], { level, preserveExisting: true });
}

export function creatorAddPokemonGroup(pokemon, level = 1) {
  return webStore.upsertPokemonCollection(pokemon, { level, preserveExisting: true });
}

export function creatorSetAllPokemonLevels(level) {
  return webStore.setAllPokemonLevels(level);
}

export function creatorSetItemQuantity(itemId, quantity) {
  return webStore.setInventoryQuantity(itemId, quantity);
}

export function creatorGrantAllItems(quantity, options) {
  return webStore.grantAllItems(quantity, options);
}

export function creatorSetHeldItem(pokemonId, itemId) {
  return webStore.setHeldItem(pokemonId, itemId || null);
}

export function creatorGetItemStock({ economy, collection, itemId }) {
  return getHeldItemStock({ economy, collection, itemId });
}

export function creatorSetTrainerXp(totalXp) {
  return webStore.setTrainerXp(totalXp);
}

export function creatorSetTrainerLevel(level) {
  return webStore.setTrainerXp(getTotalXpForTrainerLevel(level));
}

export function creatorUpdateProfile(profile) {
  return webStore.setLocalPlayerProfile(profile);
}

export function creatorExportBackup() {
  return webStore.exportBackup();
}

export function creatorImportBackup(backup) {
  return webStore.importBackup(backup);
}

export function creatorResetScope(scope) {
  return webStore.resetLocalScope(scope);
}

export { ITEM_CATALOG };
