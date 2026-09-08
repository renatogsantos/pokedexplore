import { MAX_POKEMON_LEVEL, normalizeCapturedPokemon } from "@/lib/pokemon/progression";
import { enrichPokemonRarity, hasResolvedPokemonRarity } from "@/lib/pokemon/rarity";
import { getShopUpgrade } from "@/lib/economy/gameItems";
import { getAchievement } from "@/lib/journey/achievements";

const DATABASE_NAME = "PokedExploreDB";
const DATABASE_VERSION = 3;
const POKEDEX_STORE = "pokedex";
const PLAYER_STORE = "player";
const CACHE_STORE = "pokeapi-cache";
const ECONOMY_KEY = "economy";
const TRAINER_PROFILE_KEY = "trainer-profile";
const EMPTY_ECONOMY = { key: ECONOMY_KEY, coins: 0, rewardedMatchIds: [], secretRewards: {}, inventory: {}, ownedTms: [], consumedItemActionIds: [] };
const EMPTY_PROGRESS = { achievements: {}, streak: 0, bestStreak: 0, wins: 0, totalBattles: 0, processedOutcomeMatchIds: [], journeyCompleted: [], badges: [] };
const normalizeEconomy = (economy) => ({ ...EMPTY_ECONOMY, ...(economy || {}), secretRewards: { ...EMPTY_ECONOMY.secretRewards, ...(economy?.secretRewards || {}) }, inventory: Object.fromEntries(Object.entries(economy?.inventory || {}).filter(([, quantity]) => Number(quantity) > 0).map(([id, quantity]) => [id, Math.floor(Number(quantity))])), ownedTms: [...new Set(economy?.ownedTms || [])], progress: { ...EMPTY_PROGRESS, ...(economy?.progress || {}), achievements: { ...EMPTY_PROGRESS.achievements, ...(economy?.progress?.achievements || {}) } } });

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
      return { playerId: `player_${crypto.randomUUID()}`, displayName: "Treinador", createdAt: Date.now() };
    }
  },
  async setLocalPlayerProfile(profile) {
    const displayName = String(profile?.displayName || profile?.name || "").trim().slice(0, 18) || "Treinador";
    const playerId = String(profile?.playerId || `player_${crypto.randomUUID()}`);
    const record = { key: TRAINER_PROFILE_KEY, name: displayName, playerId, createdAt: profile?.createdAt || Date.now(), updatedAt: Date.now() };
    try {
      await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        transaction.objectStore(PLAYER_STORE).put(record);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
      }));
    } catch (error) { console.error("Erro ao salvar perfil local:", error); }
    return { playerId, displayName, createdAt: record.createdAt };
  },
  async resetLocalPlayerIdentity() {
    const current = await this.getLocalPlayerProfile();
    return this.setLocalPlayerProfile({
      playerId: `player_${crypto.randomUUID()}`,
      displayName: current.displayName,
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
  async exportBackup() {
    const [collection, player] = await Promise.all([this.getData("Pokedex"), this.getEconomy()]);
    return { version: 1, exportedAt: new Date().toISOString(), collection, player };
  },
  async importBackup(backup) {
    if (!backup || backup.version !== 1 || !Array.isArray(backup.collection) || !backup.player) throw new Error("Backup inválido.");
    return withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite"); const pokedex = transaction.objectStore(POKEDEX_STORE); const player = transaction.objectStore(PLAYER_STORE);
      pokedex.clear(); backup.collection.filter((pokemon) => pokemon?.id).forEach((pokemon) => pokedex.put(normalizeCapturedPokemon(pokemon))); player.put({ ...normalizeEconomy(backup.player), key: ECONOMY_KEY });
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
          if (!request.result) store.put(economy);
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
          transaction.result = { rewarded, coins: next.coins };
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
          if (economy.coins < totalPrice) { transaction.result = { ok: false, reason: "insufficient", coins: economy.coins }; return; }
          const owned = existing ? normalizeCapturedPokemon(existing) : null;
          const availableQuantity = owned ? MAX_POKEMON_LEVEL - owned.level : MAX_POKEMON_LEVEL;
          if (availableQuantity <= 0 || requestedQuantity > availableQuantity) { transaction.result = { ok: false, reason: "max-level", coins: economy.coins, pokemon: owned, availableQuantity: Math.max(0, availableQuantity) }; return; }
          const nextPokemon = owned ? { ...owned, level: owned.level + requestedQuantity } : { ...normalizeCapturedPokemon(pokemon), level: requestedQuantity };
          const nextEconomy = { ...economy, coins: economy.coins - totalPrice };
          pokedexStore.put(nextPokemon); playerStore.put(nextEconomy);
          transaction.result = { ok: true, coins: nextEconomy.coins, pokemon: nextPokemon, duplicate: Boolean(owned), previousLevel: owned?.level || 0, quantity: requestedQuantity, totalPrice };
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
    try { const collection = await withDatabase((database) => new Promise((resolve, reject) => {
      const request = database.transaction(POKEDEX_STORE, "readonly").objectStore(POKEDEX_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).map(normalizeCapturedPokemon));
      request.onerror = () => reject(request.error);
    })); const missing = collection.filter((pokemon) => !hasResolvedPokemonRarity(pokemon)); if (!missing.length) return collection; const enriched = await Promise.all(collection.map((pokemon) => hasResolvedPokemonRarity(pokemon) ? pokemon : enrichPokemonRarity(pokemon))); await withDatabase((database) => new Promise((resolve, reject) => { const transaction = database.transaction(POKEDEX_STORE, "readwrite"); enriched.forEach((pokemon) => transaction.objectStore(POKEDEX_STORE).put(pokemon)); transaction.oncomplete = resolve; transaction.onerror = () => reject(transaction.error); })); return enriched; } catch (error) { console.error("Erro ao recuperar dados do IndexedDB:", error); return []; }
  },
  async capturePokemon(pokemon) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(POKEDEX_STORE, "readwrite"); const store = transaction.objectStore(POKEDEX_STORE); const request = store.get(pokemon.id);
      request.onsuccess = () => { const existing = request.result ? normalizeCapturedPokemon(request.result) : null; const previousLevel = existing?.level || 0; const maxLevel = Boolean(existing && existing.level >= MAX_POKEMON_LEVEL); const next = existing ? { ...existing, level: Math.min(MAX_POKEMON_LEVEL, existing.level + 1) } : normalizeCapturedPokemon(pokemon); store.put(next); transaction.result = { pokemon: next, duplicate: Boolean(existing), previousLevel, maxLevel }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao capturar Pokémon:", error); return null; }
  },
  async purchaseUpgrade(upgradeId, quantity = 1) {
    const upgrade = getShopUpgrade(upgradeId);
    if (!upgrade) return { ok: false, reason: "not-found" };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result); const amount = upgrade.category === "tm" ? 1 : Math.max(1, Math.floor(Number(quantity) || 1));
          if (upgrade.category === "tm" && economy.ownedTms.includes(upgrade.id)) { transaction.result = { ok: false, reason: "owned", coins: economy.coins, economy }; return; }
          const totalPrice = upgrade.price * amount;
          if (economy.coins < totalPrice) { transaction.result = { ok: false, reason: "insufficient", coins: economy.coins, economy }; return; }
          const next = upgrade.category === "tm"
            ? { ...economy, coins: economy.coins - totalPrice, ownedTms: [...economy.ownedTms, upgrade.id] }
            : { ...economy, coins: economy.coins - totalPrice, inventory: { ...economy.inventory, [upgrade.id]: (economy.inventory[upgrade.id] || 0) + amount } };
          store.put(next); transaction.result = { ok: true, upgrade, quantity: amount, totalPrice, coins: next.coins, economy: next };
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
    const inventoryId = heldItem.endsWith("-boost") ? "type-boost" : heldItem;
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite"); const pokedexStore = transaction.objectStore(POKEDEX_STORE); const playerStore = transaction.objectStore(PLAYER_STORE); const pokemonRequest = pokedexStore.get(pokemonId); const economyRequest = playerStore.get(ECONOMY_KEY); let pokemon; let economy;
        const finish = () => { if (!pokemon || !economy) return; if (consumptionId && economy.consumedItemActionIds?.includes(consumptionId)) { transaction.result = { ok: true, duplicate: true, economy, pokemon }; return; } if (pokemon.heldItem !== heldItem) { transaction.result = { ok: false, reason: "not-equipped", economy, pokemon }; return; } const inventory = { ...economy.inventory }; inventory[inventoryId] = Math.max(0, (inventory[inventoryId] || 0) - 1); if (!inventory[inventoryId]) delete inventory[inventoryId]; const nextEconomy = { ...economy, inventory, consumedItemActionIds: consumptionId ? [...(economy.consumedItemActionIds || []), consumptionId].slice(-100) : economy.consumedItemActionIds }; const nextPokemon = { ...pokemon, heldItem: null }; pokedexStore.put(nextPokemon); playerStore.put(nextEconomy); transaction.result = { ok: true, economy: nextEconomy, pokemon: nextPokemon }; };
        pokemonRequest.onsuccess = () => { pokemon = pokemonRequest.result ? normalizeCapturedPokemon(pokemonRequest.result) : null; finish(); }; economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
        transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); pokemonRequest.onerror = () => reject(pokemonRequest.error); economyRequest.onerror = () => reject(economyRequest.error);
      }));
    } catch (error) { console.error("Erro ao consumir item equipado:", error); return { ok: false, reason: "persistence" }; }
  },
  async recordBattleOutcome(matchId, { won, durationMs, usedOnlyOnePokemon }) {
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
        const nextProgress = { ...progress, streak: nextStreak, bestStreak: Math.max(progress.bestStreak || 0, nextStreak), wins: (progress.wins || 0) + Number(won), totalBattles: (progress.totalBattles || 0) + 1, achievements: nextAchievements, processedOutcomeMatchIds: [...processed, matchId].slice(-100) };
        const next = { ...economy, coins: economy.coins + rewardCoins, progress: nextProgress }; store.put(next); transaction.result = { recorded: true, progress: nextProgress, unlocked, rewardCoins, coins: next.coins };
      };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao salvar progresso de batalha:", error); return { recorded: false, progress: EMPTY_PROGRESS, unlocked: [] }; }
  },
  async completeJourneyNode(node) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => { const economy = normalizeEconomy(request.result); const progress = economy.progress; const completed = progress.journeyCompleted || []; const alreadyCompleted = completed.includes(node.id); const badges = node.badge && !progress.badges.includes(node.badge) ? [...progress.badges, node.badge] : progress.badges; const nextProgress = { ...progress, journeyCompleted: alreadyCompleted ? completed : [...completed, node.id], badges }; const next = { ...economy, coins: alreadyCompleted ? economy.coins : economy.coins + node.reward, progress: nextProgress }; store.put(next); transaction.result = { completed: !alreadyCompleted, coins: next.coins, progress: nextProgress, badge: node.badge || null }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao concluir jornada:", error); return { completed: false }; }
  },
  async setHeldItem(pokemonId, heldItem) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite"); const store = transaction.objectStore(POKEDEX_STORE); const playerStore = transaction.objectStore(PLAYER_STORE); const request = store.get(pokemonId); const economyRequest = playerStore.get(ECONOMY_KEY); let economy;
      const finish = () => { if (!economy || !request.result) return; const pokemon = normalizeCapturedPokemon(request.result); const normalizedItem = heldItem?.endsWith("-boost") ? "type-boost" : heldItem; const equippedRequest = store.getAll(); equippedRequest.onsuccess = () => { const equipped = equippedRequest.result.filter((item) => String(item.id) !== String(pokemonId) && (item.heldItem === heldItem || (normalizedItem === "type-boost" && item.heldItem?.endsWith("-boost")))).length; if (normalizedItem && (economy.inventory[normalizedItem] || 0) <= equipped) { transaction.result = { ok: false, reason: "not-owned" }; return; } const next = { ...pokemon, heldItem: heldItem || null }; store.put(next); transaction.result = { ok: true, pokemon: next }; }; equippedRequest.onerror = () => reject(equippedRequest.error); };
      request.onsuccess = finish; economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao equipar item:", error); return null; }
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
