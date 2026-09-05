import { MAX_POKEMON_LEVEL, normalizeCapturedPokemon } from "@/lib/pokemon/progression";

const DATABASE_NAME = "PokedExploreDB";
const DATABASE_VERSION = 1;
const POKEDEX_STORE = "pokedex";

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
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const request = database.transaction(POKEDEX_STORE, "readonly").objectStore(POKEDEX_STORE).getAll();
      request.onsuccess = () => resolve((request.result || []).map(normalizeCapturedPokemon));
      request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao recuperar dados do IndexedDB:", error); return []; }
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
