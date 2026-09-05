import { MAX_POKEMON_LEVEL, normalizeCapturedPokemon } from "@/lib/pokemon/progression";
import { enrichPokemonRarity, hasResolvedPokemonRarity } from "@/lib/pokemon/rarity";

const DATABASE_NAME = "PokedExploreDB";
const DATABASE_VERSION = 2;
const POKEDEX_STORE = "pokedex";
const PLAYER_STORE = "player";
const ECONOMY_KEY = "economy";
const EMPTY_ECONOMY = { key: ECONOMY_KEY, coins: 0, rewardedMatchIds: [] };

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
  async getEconomy() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = { ...EMPTY_ECONOMY, ...(request.result || {}) };
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
          const economy = { ...EMPTY_ECONOMY, ...(request.result || {}) };
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
  async purchasePokemon(pokemon, price) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([PLAYER_STORE, POKEDEX_STORE], "readwrite");
        const playerStore = transaction.objectStore(PLAYER_STORE); const pokedexStore = transaction.objectStore(POKEDEX_STORE);
        const economyRequest = playerStore.get(ECONOMY_KEY); const pokemonRequest = pokedexStore.get(pokemon.id);
        let economy; let existing;
        const finish = () => {
          if (!economy || existing === undefined) return;
          if (economy.coins < price) { transaction.result = { ok: false, reason: "insufficient", coins: economy.coins }; return; }
          const owned = existing ? normalizeCapturedPokemon(existing) : null;
          if (owned?.level >= MAX_POKEMON_LEVEL) { transaction.result = { ok: false, reason: "max-level", coins: economy.coins, pokemon: owned }; return; }
          const nextPokemon = owned ? { ...owned, level: owned.level + 1 } : normalizeCapturedPokemon(pokemon);
          const nextEconomy = { ...economy, coins: economy.coins - price };
          pokedexStore.put(nextPokemon); playerStore.put(nextEconomy);
          transaction.result = { ok: true, coins: nextEconomy.coins, pokemon: nextPokemon, duplicate: Boolean(owned), previousLevel: owned?.level || 0 };
        };
        economyRequest.onsuccess = () => { economy = { ...EMPTY_ECONOMY, ...(economyRequest.result || {}) }; finish(); };
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
