import { MAX_POKEMON_LEVEL, normalizeCapturedPokemon } from "@/lib/pokemon/progression";
import { enrichPokemonRarity, hasResolvedPokemonRarity } from "@/lib/pokemon/rarity";
import { getShopUpgrade } from "@/lib/economy/gameItems";
import { getHeldItemInventoryId, planHeldItemChange } from "@/lib/economy/heldItems";
import { getAchievement } from "@/lib/journey/achievements";
import { normalizePlayerStats, recordCompletedBattle } from "@/lib/profile/progression";
import { DEFAULT_PLAYER_AVATAR_ID, normalizePlayerAvatarId } from "@/lib/profile/avatars";
import { getItemDefinition, ITEM_CATALOG, ITEM_SYSTEM_VERSION, migrateItemInventory } from "@/lib/items/catalog";

const DATABASE_NAME = "PokedExploreDB";
const DATABASE_VERSION = 3;
const POKEDEX_STORE = "pokedex";
const PLAYER_STORE = "player";
const CACHE_STORE = "pokeapi-cache";
const ECONOMY_KEY = "economy";
const TRAINER_PROFILE_KEY = "trainer-profile";
const DECKS_KEY = "pokemon-decks";
const EMPTY_CREATOR_MODE = { infiniteCoins: false };
const EMPTY_ECONOMY = { key: ECONOMY_KEY, coins: 0, rewardedMatchIds: [], secretRewards: {}, inventory: {}, ownedTms: [], consumedItemActionIds: [], itemSystemVersion: ITEM_SYSTEM_VERSION, creatorMode: EMPTY_CREATOR_MODE };
const EMPTY_PROGRESS = { achievements: {}, streak: 0, bestStreak: 0, wins: 0, totalBattles: 0, processedOutcomeMatchIds: [], journeyCompleted: [], badges: [], trainerXp: 0, playerStats: null };
const normalizeEconomy = (economy) => {
  const savedProgress = economy?.progress || {};
  const progress = {
    ...EMPTY_PROGRESS,
    ...savedProgress,
    trainerXp: Math.max(0, Math.floor(Number(savedProgress.trainerXp) || 0)),
    achievements: { ...EMPTY_PROGRESS.achievements, ...(savedProgress.achievements || {}) },
    playerStats: normalizePlayerStats(savedProgress.playerStats, { legacyWins: savedProgress.wins, legacyBattles: savedProgress.totalBattles }),
  };
  const legacy = Number(economy?.itemSystemVersion || 1) < ITEM_SYSTEM_VERSION;
  const rawInventory = Object.fromEntries(Object.entries(economy?.inventory || {}).filter(([, quantity]) => Number(quantity) > 0).map(([id, quantity]) => [id, Math.floor(Number(quantity))]));
  return { ...EMPTY_ECONOMY, ...(economy || {}), itemSystemVersion: ITEM_SYSTEM_VERSION, secretRewards: { ...EMPTY_ECONOMY.secretRewards, ...(economy?.secretRewards || {}) }, inventory: legacy ? migrateItemInventory(rawInventory) : rawInventory, ownedTms: [...new Set(economy?.ownedTms || [])], creatorMode: { ...EMPTY_CREATOR_MODE, ...(economy?.creatorMode || {}), infiniteCoins: Boolean(economy?.creatorMode?.infiniteCoins) }, progress };
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB não está disponível neste ambiente."));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(POKEDEX_STORE)) {
        database.createObjectStore(POKEDEX_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(PLAYER_STORE)) {
        database.createObjectStore(PLAYER_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function migrateLocalStorage(database) {
  if (window.localStorage.getItem("PokedExploreIndexedDBMigrated")) return;
  let oldData = [];
  try { oldData = JSON.parse(window.localStorage.getItem("Pokedex")) || []; }
  catch (error) { console.error("Erro ao migrar a Pokédex antiga:", error); }
  if (oldData.length) await new Promise((resolve, reject) => {
    const transaction = database.transaction(POKEDEX_STORE, "readwrite");
    oldData.filter((pokemon) => pokemon?.id).forEach((pokemon) => transaction.objectStore(POKEDEX_STORE).put(pokemon));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  window.localStorage.setItem("PokedExploreIndexedDBMigrated", "true");
}

async function withDatabase(callback) {
  const database = await openDatabase();
  try { await migrateLocalStorage(database); return await callback(database); }
  finally { database.close(); }
}

export const webStore = {
  async getTrainerName() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(PLAYER_STORE, "readonly").objectStore(PLAYER_STORE).get(TRAINER_PROFILE_KEY);
        request.onsuccess = () => resolve(String(request.result?.name || "").trim() || "Treinador");
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao recuperar nome do treinador:", error); return "Treinador"; }
  },
  async getLocalPlayerProfile() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const store = database.transaction(PLAYER_STORE, "readonly").objectStore(PLAYER_STORE);
        const request = store.get(TRAINER_PROFILE_KEY);
        request.onsuccess = () => {
          const saved = request.result || {};
          resolve({
            playerId: saved.playerId || `player_${crypto.randomUUID()}`,
            displayName: String(saved.name || "").trim() || "Treinador",
            avatarId: normalizePlayerAvatarId(saved.avatarId),
            createdAt: saved.createdAt || Date.now(),
          });
        };
        request.onerror = () => reject(request.error);
      })).then(async (profile) => {
        await this.setLocalPlayerProfile(profile);
        return profile;
      });
    } catch (error) {
      console.error("Erro ao recuperar perfil local:", error);
      return { playerId: `player_${crypto.randomUUID()}`, displayName: "Treinador", avatarId: DEFAULT_PLAYER_AVATAR_ID, createdAt: Date.now() };
    }
  },
  async setLocalPlayerProfile(profile) {
    const displayName = String(profile?.displayName || profile?.name || "").trim().slice(0, 18) || "Treinador";
    const playerId = String(profile?.playerId || `player_${crypto.randomUUID()}`);
    const avatarId = normalizePlayerAvatarId(profile?.avatarId);
    const record = { key: TRAINER_PROFILE_KEY, name: displayName, playerId, avatarId, createdAt: profile?.createdAt || Date.now(), updatedAt: Date.now() };
    try {
      await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        transaction.objectStore(PLAYER_STORE).put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao salvar perfil local:", error); }
    return { playerId, displayName, avatarId, createdAt: record.createdAt };
  },
  async resetLocalPlayerIdentity() {
    const current = await this.getLocalPlayerProfile();
    return this.setLocalPlayerProfile({
      playerId: `player_${crypto.randomUUID()}`,
      displayName: current.displayName,
      avatarId: current.avatarId,
      createdAt: Date.now(),
    });
  },
  async setTrainerName(name) {
    const trainerName = String(name || "").trim().slice(0, 18) || "Treinador";
    try {
      await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(TRAINER_PROFILE_KEY);
        request.onsuccess = () => store.put({ ...(request.result || {}), key: TRAINER_PROFILE_KEY, name: trainerName, playerId: request.result?.playerId || `player_${crypto.randomUUID()}`, createdAt: request.result?.createdAt || Date.now(), updatedAt: Date.now() });
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      }));
      return trainerName;
    } catch (error) { console.error("Erro ao salvar nome do treinador:", error); return trainerName; }
  },
  async getDecks() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(PLAYER_STORE, "readonly").objectStore(PLAYER_STORE).get(DECKS_KEY);
        request.onsuccess = () => resolve(Array.isArray(request.result?.decks) ? request.result.decks.filter((deck) => deck?.id && Array.isArray(deck.pokemonIds)).map((deck) => ({ id: String(deck.id), name: String(deck.name || "Time sem nome").trim() || "Time sem nome", pokemonIds: deck.pokemonIds.map(String).slice(0, 3), createdAt: deck.createdAt || Date.now(), updatedAt: deck.updatedAt || Date.now() })) : []);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao recuperar decks:", error); return []; }
  },
  async saveDeck(deck) {
    const pokemonIds = [...new Set((deck?.pokemonIds || []).map(String).filter(Boolean))];
    if (pokemonIds.length !== 3) return null;
    const id = String(deck?.id || `deck_${crypto.randomUUID()}`);
    const name = String(deck?.name || "").trim().slice(0, 28);
    if (!name) return null;
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(DECKS_KEY);
        request.onsuccess = () => {
          const previous = Array.isArray(request.result?.decks) ? request.result.decks : [];
          const current = previous.find((item) => String(item.id) === id);
          const saved = { id, name, pokemonIds, createdAt: current?.createdAt || deck?.createdAt || Date.now(), updatedAt: Date.now() };
          store.put({ key: DECKS_KEY, decks: [...previous.filter((item) => String(item.id) !== id), saved] });
          transaction.result = saved;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao salvar deck:", error); return null; }
  },
  async deleteDeck(deckId) {
    if (!deckId) return false;
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(DECKS_KEY);
        request.onsuccess = () => {
          const previous = Array.isArray(request.result?.decks) ? request.result.decks : [];
          store.put({ key: DECKS_KEY, decks: previous.filter((deck) => String(deck.id) !== String(deckId)) });
          transaction.result = true;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao excluir deck:", error); return false; }
  },
  async exportBackup() {
    return withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE, CACHE_STORE], "readonly");
      const collectionRequest = transaction.objectStore(POKEDEX_STORE).getAll();
      const playerRequest = transaction.objectStore(PLAYER_STORE).getAll();
      const cacheRequest = transaction.objectStore(CACHE_STORE).getAll();
      transaction.oncomplete = () => resolve({
        format: "pokedexplore-save",
        version: 2,
        exportedAt: new Date().toISOString(),
        database: { name: DATABASE_NAME, version: DATABASE_VERSION },
        stores: {
          [POKEDEX_STORE]: (collectionRequest.result || []).map(normalizeCapturedPokemon),
          [PLAYER_STORE]: (playerRequest.result || []).map((record) => record?.key === ECONOMY_KEY ? normalizeEconomy(record) : record),
          [CACHE_STORE]: cacheRequest.result || [],
        },
      });
      transaction.onerror = () => reject(transaction.error);
    }));
  },
  async importBackup(backup) {
    const legacy = backup?.version === 1 && Array.isArray(backup.collection) && backup.player;
    const current = backup?.version === 2 && backup?.format === "pokedexplore-save" && Array.isArray(backup?.stores?.[POKEDEX_STORE]) && Array.isArray(backup?.stores?.[PLAYER_STORE]);
    if (!legacy && !current) throw new Error("Backup inválido.");
    return withDatabase((database) => new Promise((resolve, reject) => {
      const stores = current ? [POKEDEX_STORE, PLAYER_STORE, CACHE_STORE] : [POKEDEX_STORE, PLAYER_STORE];
      const transaction = database.transaction(stores, "readwrite");
      const pokedex = transaction.objectStore(POKEDEX_STORE);
      const player = transaction.objectStore(PLAYER_STORE);
      pokedex.clear();
      if (current) player.clear();
      const collection = legacy ? backup.collection : backup.stores[POKEDEX_STORE];
      collection.filter((pokemon) => pokemon?.id).forEach((pokemon) => pokedex.put(normalizeCapturedPokemon(pokemon)));
      if (legacy) {
        player.put({ ...normalizeEconomy(backup.player), key: ECONOMY_KEY });
      } else {
        backup.stores[PLAYER_STORE].filter((record) => record?.key).forEach((record) => player.put(record.key === ECONOMY_KEY ? normalizeEconomy(record) : record));
        const cache = transaction.objectStore(CACHE_STORE);
        cache.clear();
        (backup.stores[CACHE_STORE] || []).filter((record) => record?.key).forEach((record) => cache.put(record));
      }
      transaction.oncomplete = () => resolve(true); transaction.onerror = () => reject(transaction.error);
    }));
  },
  async getCachedResource(key) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => { const request = database.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(key); request.onsuccess = () => resolve(request.result?.value || null); request.onerror = () => reject(request.error); })); } catch { return null; }
  },
  async setCachedResource(key, value) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => { const transaction = database.transaction(CACHE_STORE, "readwrite"); transaction.objectStore(CACHE_STORE).put({ key, value, cachedAt: Date.now() }); transaction.oncomplete = () => resolve(true); transaction.onerror = () => reject(transaction.error); })); } catch { return false; }
  },
  async getEconomy() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          if (!request.result || Number(request.result.itemSystemVersion || 1) < ITEM_SYSTEM_VERSION) store.put(economy);
          transaction.result = economy;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao recuperar moedas:", error); return { ...EMPTY_ECONOMY }; }
  },
  async rewardVictory(matchId, amount) {
    if (!matchId) return { rewarded: false, coins: 0 };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const rewardedMatchIds = economy.rewardedMatchIds || [];
          const rewarded = !rewardedMatchIds.includes(matchId);
          const next = rewarded ? { ...economy, coins: economy.coins + amount, rewardedMatchIds: [...rewardedMatchIds, matchId].slice(-100) } : economy;
          if (rewarded) store.put(next);
          transaction.result = { rewarded, coins: next.coins, infiniteCoins: Boolean(next.creatorMode?.infiniteCoins) };
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao conceder moedas:", error); return { rewarded: false, coins: 0 }; }
  },
  async claimSecretReward(rewardId, amount) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const claimed = !economy.secretRewards[rewardId];
          const next = claimed ? { ...economy, coins: economy.coins + amount, secretRewards: { ...economy.secretRewards, [rewardId]: true } } : economy;
          if (claimed) store.put(next);
          transaction.result = { claimed, coins: next.coins };
        };
        transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao resgatar recompensa secreta:", error); return { claimed: false, coins: 0 }; }
  },
  async purchasePokemon(pokemon, price, quantity = 1) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([PLAYER_STORE, POKEDEX_STORE], "readwrite");
        const playerStore = transaction.objectStore(PLAYER_STORE); const pokedexStore = transaction.objectStore(POKEDEX_STORE);
        const economyRequest = playerStore.get(ECONOMY_KEY); const pokemonRequest = pokedexStore.get(pokemon.id);
        let economy; let existing;
        const finish = () => {
          if (!economy || existing === undefined) return;
          const requestedQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
          const totalPrice = price * requestedQuantity;
          const infiniteCoins = Boolean(economy.creatorMode?.infiniteCoins);
          if (!infiniteCoins && economy.coins < totalPrice) { transaction.result = { ok: false, reason: "insufficient", coins: economy.coins, infiniteCoins }; return; }
          const owned = existing ? normalizeCapturedPokemon(existing) : null;
          const availableQuantity = owned ? MAX_POKEMON_LEVEL - owned.level : MAX_POKEMON_LEVEL;
          if (availableQuantity <= 0 || requestedQuantity > availableQuantity) { transaction.result = { ok: false, reason: "max-level", coins: economy.coins, pokemon: owned, availableQuantity: Math.max(0, availableQuantity) }; return; }
          const nextPokemon = owned ? { ...owned, level: owned.level + requestedQuantity } : { ...normalizeCapturedPokemon(pokemon), level: requestedQuantity };
          const nextEconomy = { ...economy, coins: infiniteCoins ? economy.coins : economy.coins - totalPrice };
          pokedexStore.put(nextPokemon); playerStore.put(nextEconomy);
          transaction.result = { ok: true, coins: nextEconomy.coins, infiniteCoins, pokemon: nextPokemon, duplicate: Boolean(owned), previousLevel: owned?.level || 0, quantity: requestedQuantity, totalPrice };
        };
        economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
        pokemonRequest.onsuccess = () => { existing = pokemonRequest.result || null; finish(); };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        economyRequest.onerror = () => reject(economyRequest.error); pokemonRequest.onerror = () => reject(pokemonRequest.error);
      }));
    } catch (error) { console.error("Erro ao comprar Pokémon:", error); return { ok: false, reason: "persistence" }; }
  },
  async saveData(_key, data) {
    try {
      await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(POKEDEX_STORE, "readwrite");
        transaction.objectStore(POKEDEX_STORE).put(data);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      }));
      return true;
    } catch (error) { console.error("Erro ao salvar dados no IndexedDB:", error); return false; }
  },
  async getData(_key) {
    try {
      const records = await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(POKEDEX_STORE, "readonly").objectStore(POKEDEX_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }));
      const normalized = records.map(normalizeCapturedPokemon);
      const collection = await Promise.all(normalized.map((pokemon) => hasResolvedPokemonRarity(pokemon) ? pokemon : enrichPokemonRarity(pokemon)));
      const needsMigration = records.some((record, index) =>
        record.heldItem !== collection[index].heldItem ||
        "held_item" in record ||
        "equippedItem" in record ||
        "equipped_item" in record
      );
      if (needsMigration || collection.some((pokemon, index) => !hasResolvedPokemonRarity(normalized[index]) && hasResolvedPokemonRarity(pokemon))) {
        await withDatabase((database) => new Promise((resolve, reject) => {
          const transaction = database.transaction(POKEDEX_STORE, "readwrite");
          collection.forEach((pokemon) => transaction.objectStore(POKEDEX_STORE).put(pokemon));
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error);
        }));
      }
      return collection;
    } catch (error) { console.error("Erro ao recuperar dados do IndexedDB:", error); return []; }
  },
  async capturePokemon(pokemon) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(POKEDEX_STORE, "readwrite"); const store = transaction.objectStore(POKEDEX_STORE); const request = store.get(pokemon.id);
      request.onsuccess = () => { const existing = request.result ? normalizeCapturedPokemon(request.result) : null; const previousLevel = existing?.level || 0; const maxLevel = Boolean(existing && existing.level >= MAX_POKEMON_LEVEL); const next = existing ? { ...existing, level: Math.min(MAX_POKEMON_LEVEL, existing.level + 1) } : normalizeCapturedPokemon(pokemon); store.put(next); transaction.result = { pokemon: next, duplicate: Boolean(existing), previousLevel, maxLevel }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao capturar Pokémon:", error); return null; }
  },
  async getCollectionSnapshot() {
    try {
      const records = await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(POKEDEX_STORE, "readonly").objectStore(POKEDEX_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }));
      return records.map(normalizeCapturedPokemon);
    } catch (error) {
      console.error("Erro ao recuperar resumo da coleção:", error);
      return [];
    }
  },
  async purchaseUpgrade(upgradeId, quantity = 1) {
    const upgrade = getShopUpgrade(upgradeId);
    if (!upgrade) return { ok: false, reason: "not-found" };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result); const amount = upgrade.category === "tm" ? 1 : Math.max(1, Math.floor(Number(quantity) || 1));
          if (upgrade.category === "tm" && economy.ownedTms.includes(upgrade.id)) { transaction.result = { ok: false, reason: "owned", coins: economy.coins, infiniteCoins: Boolean(economy.creatorMode?.infiniteCoins), economy }; return; }
          const totalPrice = upgrade.price * amount;
          const infiniteCoins = Boolean(economy.creatorMode?.infiniteCoins);
          if (!infiniteCoins && economy.coins < totalPrice) { transaction.result = { ok: false, reason: "insufficient", coins: economy.coins, infiniteCoins, economy }; return; }
          const next = upgrade.category === "tm"
            ? { ...economy, coins: infiniteCoins ? economy.coins : economy.coins - totalPrice, ownedTms: [...economy.ownedTms, upgrade.id] }
            : { ...economy, coins: infiniteCoins ? economy.coins : economy.coins - totalPrice, inventory: { ...economy.inventory, [upgrade.id]: (economy.inventory[upgrade.id] || 0) + amount } };
          store.put(next); transaction.result = { ok: true, upgrade, quantity: amount, totalPrice, coins: next.coins, infiniteCoins, economy: next };
        };
        transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao comprar item:", error); return { ok: false, reason: "persistence" }; }
  },
  async consumeInventory(items, consumptionId) {
    const used = Object.fromEntries(Object.entries(items || {}).filter(([, quantity]) => Number(quantity) > 0).map(([id, quantity]) => [id, Math.floor(Number(quantity))]));
    if (!Object.keys(used).length) return { ok: true, economy: await this.getEconomy() };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => { const economy = normalizeEconomy(request.result); if (consumptionId && economy.consumedItemActionIds?.includes(consumptionId)) { transaction.result = { ok: true, duplicate: true, economy }; return; } const inventory = { ...economy.inventory }; Object.entries(used).forEach(([id, quantity]) => { inventory[id] = Math.max(0, (inventory[id] || 0) - quantity); if (!inventory[id]) delete inventory[id]; }); const next = { ...economy, inventory, consumedItemActionIds: consumptionId ? [...(economy.consumedItemActionIds || []), consumptionId].slice(-100) : economy.consumedItemActionIds }; store.put(next); transaction.result = { ok: true, economy: next }; };
        transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao consumir inventário:", error); return { ok: false }; }
  },
  async consumeHeldItem(pokemonId, heldItem, consumptionId) {
    if (!pokemonId || !heldItem) return { ok: false, reason: "invalid-item" };
    const inventoryId = getHeldItemInventoryId(heldItem);
    if (!inventoryId) return { ok: false, reason: "invalid-item" };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite");
        const pokedexStore = transaction.objectStore(POKEDEX_STORE);
        const playerStore = transaction.objectStore(PLAYER_STORE);
        const collectionRequest = pokedexStore.getAll();
        const economyRequest = playerStore.get(ECONOMY_KEY);
        let collection;
        let economy;
        const finish = () => {
          if (!collection || !economy) return;
          const pokemon = collection.find((entry) => String(entry.id) === String(pokemonId));
          if (!pokemon) { transaction.result = { ok: false, reason: "pokemon-not-found", economy }; return; }
          if (consumptionId && economy.consumedItemActionIds?.includes(consumptionId)) { transaction.result = { ok: true, duplicate: true, economy, pokemon }; return; }
          if (pokemon.heldItem !== heldItem) { transaction.result = { ok: false, reason: "not-equipped", economy, pokemon }; return; }
          const inventory = { ...economy.inventory };
          inventory[inventoryId] = Math.max(0, (inventory[inventoryId] || 0) - 1);
          if (!inventory[inventoryId]) delete inventory[inventoryId];
          const nextEconomy = { ...economy, inventory, consumedItemActionIds: consumptionId ? [...(economy.consumedItemActionIds || []), consumptionId].slice(-100) : economy.consumedItemActionIds };
          const nextPokemon = { ...pokemon, heldItem: null };
          pokedexStore.put(nextPokemon);
          playerStore.put(nextEconomy);
          transaction.result = { ok: true, economy: nextEconomy, pokemon: nextPokemon };
        };
        collectionRequest.onsuccess = () => { collection = (collectionRequest.result || []).map(normalizeCapturedPokemon); finish(); };
        economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        collectionRequest.onerror = () => reject(collectionRequest.error);
        economyRequest.onerror = () => reject(economyRequest.error);
      }));
    } catch (error) { console.error("Erro ao consumir item equipado:", error); return { ok: false, reason: "persistence" }; }
  },
  async recordBattleOutcome(matchId, { won, durationMs, usedOnlyOnePokemon, mode = "cpu" }) {
    if (!matchId) return { recorded: false, progress: EMPTY_PROGRESS, unlocked: [] };
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => {
        const economy = normalizeEconomy(request.result); const progress = economy.progress; const processed = progress.processedOutcomeMatchIds || [];
        if (processed.includes(matchId)) { transaction.result = { recorded: false, progress, unlocked: [] }; return; }
        const nextStreak = won ? progress.streak + 1 : 0; const nextAchievements = { ...progress.achievements }; const unlocked = [];
        const unlock = (id) => { if (!nextAchievements[id]) { nextAchievements[id] = true; unlocked.push(id); } };
        if (won) unlock("primeira-vitoria");
        if (won && Number.isFinite(durationMs) && durationMs < 60_000) unlock("velocista");
        if (won && usedOnlyOnePokemon) unlock("exercito-de-um");
        if (won && nextStreak >= 5) unlock("imparavel");
        const rewardCoins = unlocked.reduce((total, id) => total + (getAchievement(id)?.reward || 0), 0);
        const profileResult = recordCompletedBattle(progress.playerStats, { matchId, won, mode });
        const nextProgress = { ...progress, streak: nextStreak, bestStreak: Math.max(progress.bestStreak || 0, nextStreak), wins: (progress.wins || 0) + Number(won), totalBattles: (progress.totalBattles || 0) + 1, achievements: nextAchievements, processedOutcomeMatchIds: [...processed, matchId].slice(-100), playerStats: profileResult.stats, trainerXp: progress.trainerXp + profileResult.earnedXp };
        const next = { ...economy, coins: economy.coins + rewardCoins, progress: nextProgress }; store.put(next); transaction.result = { recorded: true, progress: nextProgress, unlocked, rewardCoins, coins: next.coins };
      };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao salvar progresso de batalha:", error); return { recorded: false, progress: EMPTY_PROGRESS, unlocked: [] }; }
  },
  async recordPlayerBattleResult(matchId, { won, mode }) {
    if (!matchId) return { recorded: false, stats: normalizePlayerStats(), earnedXp: 0, trainerXp: 0 };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const result = recordCompletedBattle(economy.progress.playerStats, { matchId, won, mode });
          const trainerXp = economy.progress.trainerXp + result.earnedXp;
          if (result.recorded) store.put({ ...economy, progress: { ...economy.progress, playerStats: result.stats, trainerXp } });
          transaction.result = { ...result, trainerXp };
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) {
      console.error("Erro ao salvar estatísticas do treinador:", error);
      return { recorded: false, stats: normalizePlayerStats(), earnedXp: 0, trainerXp: 0 };
    }
  },
  async completeJourneyNode(node) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => { const economy = normalizeEconomy(request.result); const progress = economy.progress; const completed = progress.journeyCompleted || []; const alreadyCompleted = completed.includes(node.id); const badges = node.badge && !progress.badges.includes(node.badge) ? [...progress.badges, node.badge] : progress.badges; const nextProgress = { ...progress, journeyCompleted: alreadyCompleted ? completed : [...completed, node.id], badges }; const next = { ...economy, coins: alreadyCompleted ? economy.coins : economy.coins + node.reward, progress: nextProgress }; store.put(next); transaction.result = { completed: !alreadyCompleted, coins: next.coins, progress: nextProgress, badge: node.badge || null }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao concluir jornada:", error); return { completed: false }; }
  },
  async setHeldItem(pokemonId, heldItem) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite");
        const pokedexStore = transaction.objectStore(POKEDEX_STORE);
        const playerStore = transaction.objectStore(PLAYER_STORE);
        const collectionRequest = pokedexStore.getAll();
        const economyRequest = playerStore.get(ECONOMY_KEY);
        let collection;
        let economy;
        const finish = () => {
          if (!collection || !economy) return;
          const result = planHeldItemChange({ pokemonId, requestedItem: heldItem, economy, collection });
          if (result.ok && !result.unchanged) pokedexStore.put(result.pokemon);
          transaction.result = result;
          if (process.env.NODE_ENV !== "production") console.info("[HeldItem]", { operation: heldItem ? "equip" : "unequip", pokemonId, itemId: heldItem || null, previousItem: result.previousHeldItem || null, owned: result.stock?.owned, reserved: result.stock?.equipped, available: result.stock?.available, result: result.ok ? "success" : result.reason });
        };
        collectionRequest.onsuccess = () => { collection = (collectionRequest.result || []).map(normalizeCapturedPokemon); finish(); };
        economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
        transaction.oncomplete = () => resolve(transaction.result || { ok: false, reason: "persistence" });
        transaction.onerror = () => reject(transaction.error);
        collectionRequest.onerror = () => reject(collectionRequest.error);
        economyRequest.onerror = () => reject(economyRequest.error);
      }));
    } catch (error) { console.error("Erro ao equipar item:", error); return { ok: false, reason: "persistence" }; }
  },
  async setCoinBalance(value) {
    const coins = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value) || 0)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const next = { ...normalizeEconomy(request.result), coins };
          store.put(next);
          transaction.result = next;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao definir moedas:", error); return null; }
  },
  async setInfiniteCoins(enabled) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const next = { ...economy, creatorMode: { ...economy.creatorMode, infiniteCoins: Boolean(enabled) } };
          store.put(next);
          transaction.result = next;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao definir modo de moedas:", error); return null; }
  },
  async setTrainerXp(value) {
    const trainerXp = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value) || 0)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const next = { ...economy, progress: { ...economy.progress, trainerXp } };
          store.put(next);
          transaction.result = next;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao definir XP do treinador:", error); return null; }
  },
  async setInventoryQuantity(itemId, value) {
    const item = getItemDefinition(itemId);
    if (!item) return { ok: false, reason: "invalid-item" };
    const quantity = Math.min(999999, Math.max(0, Math.floor(Number(value) || 0)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([PLAYER_STORE, POKEDEX_STORE], "readwrite");
        const playerStore = transaction.objectStore(PLAYER_STORE);
        const pokedexStore = transaction.objectStore(POKEDEX_STORE);
        const economyRequest = playerStore.get(ECONOMY_KEY);
        const collectionRequest = pokedexStore.getAll();
        let economy;
        let collection;
        const finish = () => {
          if (!economy || !collection) return;
          const reserved = collection.filter((pokemon) => pokemon.heldItem === item.id).length;
          if (quantity < reserved) {
            transaction.result = { ok: false, reason: "reserved", reserved, quantity: economy.inventory[item.id] || 0, economy };
            return;
          }
          const inventory = { ...economy.inventory };
          if (quantity > 0) inventory[item.id] = quantity;
          else delete inventory[item.id];
          const next = { ...economy, inventory };
          playerStore.put(next);
          transaction.result = { ok: true, item, quantity, reserved, available: quantity - reserved, economy: next };
        };
        economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
        collectionRequest.onsuccess = () => { collection = (collectionRequest.result || []).map(normalizeCapturedPokemon); finish(); };
        transaction.oncomplete = () => resolve(transaction.result || { ok: false, reason: "persistence" });
        transaction.onerror = () => reject(transaction.error);
        economyRequest.onerror = () => reject(economyRequest.error);
        collectionRequest.onerror = () => reject(collectionRequest.error);
      }));
    } catch (error) { console.error("Erro ao definir inventário:", error); return { ok: false, reason: "persistence" }; }
  },
  async grantAllItems(value, { preserveHigher = true } = {}) {
    const quantity = Math.min(999999, Math.max(0, Math.floor(Number(value) || 0)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const inventory = { ...economy.inventory };
          ITEM_CATALOG.forEach((item) => {
            inventory[item.id] = preserveHigher ? Math.max(inventory[item.id] || 0, quantity) : quantity;
          });
          const next = { ...economy, inventory };
          store.put(next);
          transaction.result = next;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao conceder itens:", error); return null; }
  },
  async setPokemonLevel(pokemonId, value) {
    const level = Math.min(MAX_POKEMON_LEVEL, Math.max(1, Math.floor(Number(value) || 1)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(POKEDEX_STORE, "readwrite");
        const store = transaction.objectStore(POKEDEX_STORE);
        const request = store.get(pokemonId);
        request.onsuccess = () => {
          if (!request.result) { transaction.result = null; return; }
          const next = { ...normalizeCapturedPokemon(request.result), level };
          store.put(next);
          transaction.result = next;
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao definir nível do Pokémon:", error); return null; }
  },
  async removePokemon(pokemonId) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(POKEDEX_STORE, "readwrite");
        transaction.objectStore(POKEDEX_STORE).delete(pokemonId);
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao remover Pokémon:", error); return false; }
  },
  async upsertPokemonCollection(pokemonList, { level = 1, preserveExisting = true } = {}) {
    const entries = (pokemonList || []).filter((pokemon) => pokemon?.id);
    if (!entries.length) return { ok: true, added: 0, updated: 0 };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(POKEDEX_STORE, "readwrite");
        const store = transaction.objectStore(POKEDEX_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
          const existing = new Map((request.result || []).map((pokemon) => [String(pokemon.id), normalizeCapturedPokemon(pokemon)]));
          let added = 0;
          let updated = 0;
          entries.forEach((pokemon) => {
            const current = existing.get(String(pokemon.id));
            if (current && preserveExisting) return;
            const next = normalizeCapturedPokemon({ ...(current || pokemon), ...(!current ? pokemon : {}), level: current ? Math.max(current.level, level) : level });
            store.put(next);
            if (current) updated += 1;
            else added += 1;
          });
          transaction.result = { ok: true, added, updated };
        };
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao atualizar coleção:", error); return { ok: false, added: 0, updated: 0 }; }
  },
  async setAllPokemonLevels(value) {
    const level = Math.min(MAX_POKEMON_LEVEL, Math.max(1, Math.floor(Number(value) || 1)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(POKEDEX_STORE, "readwrite");
        const store = transaction.objectStore(POKEDEX_STORE);
        const request = store.getAll();
        request.onsuccess = () => {
          const records = (request.result || []).map((pokemon) => ({ ...normalizeCapturedPokemon(pokemon), level }));
          records.forEach((pokemon) => store.put(pokemon));
          transaction.result = records.length;
        };
        transaction.oncomplete = () => resolve(transaction.result || 0);
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao definir níveis da coleção:", error); return 0; }
  },
  async getStorageSnapshot() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE, CACHE_STORE], "readonly");
        const pokedexRequest = transaction.objectStore(POKEDEX_STORE).getAllKeys();
        const playerRequest = transaction.objectStore(PLAYER_STORE).getAll();
        const cacheRequest = transaction.objectStore(CACHE_STORE).getAllKeys();
        transaction.oncomplete = () => resolve({
          name: DATABASE_NAME,
          version: database.version,
          stores: {
            [POKEDEX_STORE]: { count: (pokedexRequest.result || []).length, keys: pokedexRequest.result || [] },
            [PLAYER_STORE]: { count: (playerRequest.result || []).length, keys: (playerRequest.result || []).map((record) => record.key), records: (playerRequest.result || []).map((record) => record?.key === ECONOMY_KEY ? normalizeEconomy(record) : record) },
            [CACHE_STORE]: { count: (cacheRequest.result || []).length, keys: cacheRequest.result || [] },
          },
        });
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao inspecionar IndexedDB:", error); return null; }
  },
  async resetLocalScope(scope) {
    const supported = ["collection", "inventory", "profile", "all"];
    if (!supported.includes(scope)) return false;
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const storeNames = scope === "inventory" || scope === "all" ? [POKEDEX_STORE, PLAYER_STORE] : scope === "profile" ? [PLAYER_STORE] : [POKEDEX_STORE];
        const transaction = database.transaction(storeNames, "readwrite");
        if (scope === "collection") transaction.objectStore(POKEDEX_STORE).clear();
        if (scope === "profile") transaction.objectStore(PLAYER_STORE).delete(TRAINER_PROFILE_KEY);
        if (scope === "all") {
          transaction.objectStore(POKEDEX_STORE).clear();
          transaction.objectStore(PLAYER_STORE).clear();
        }
        if (scope === "inventory") {
          const pokedexStore = transaction.objectStore(POKEDEX_STORE);
          const playerStore = transaction.objectStore(PLAYER_STORE);
          const collectionRequest = pokedexStore.getAll();
          const economyRequest = playerStore.get(ECONOMY_KEY);
          collectionRequest.onsuccess = () => (collectionRequest.result || []).map(normalizeCapturedPokemon).filter((pokemon) => pokemon.heldItem).forEach((pokemon) => pokedexStore.put({ ...pokemon, heldItem: null }));
          economyRequest.onsuccess = () => playerStore.put({ ...normalizeEconomy(economyRequest.result), inventory: {} });
        }
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao resetar save local:", error); return false; }
  },
  async setMoveset(pokemonId, moveset) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(POKEDEX_STORE, "readwrite"); const store = transaction.objectStore(POKEDEX_STORE); const request = store.get(pokemonId);
      request.onsuccess = () => { if (!request.result) { transaction.result = null; return; } const pokemon = normalizeCapturedPokemon(request.result); const next = { ...pokemon, moveset: (moveset || []).slice(0, 4) }; store.put(next); transaction.result = next; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao salvar moveset:", error); return null; }
  },
  async deleteData() {
    try { await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(POKEDEX_STORE, "readwrite");
      transaction.objectStore(POKEDEX_STORE).clear();
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    })); return true; } catch (error) { console.error("Erro ao deletar dados do IndexedDB:", error); return false; }
  },
  deleteAllData() { return this.deleteData(); },
};
