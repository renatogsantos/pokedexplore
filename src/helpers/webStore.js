import { resizeDurableInventory, EQUIPMENT_FIELDS, clearEquipmentSlot, normalizeDurableInventory, migrateDurableEquipment, resolveDurableEquipment, settleEquipmentWear, DURABLE_EQUIPMENT_VERSION, DURABLE_REPAIR_VERSION } from "@/lib/economy/durableEquipment";
import { MAX_POKEMON_LEVEL, normalizeCapturedPokemon } from "@/lib/pokemon/progression";
import { enrichPokemonRarity, hasResolvedPokemonRarity } from "@/lib/pokemon/rarity";
import { getShopUpgrade } from "@/lib/economy/gameItems";
import { getHeldItemInventoryId, planHeldItemChange } from "@/lib/economy/heldItems";
import { getAchievement } from "@/lib/journey/achievements";
import { getJourneyRoute, isJourneyNodeUnlocked, JOURNEY_MEDALS, resolveJourneyLoot } from "@/lib/journey";
import { normalizePlayerStats, recordCompletedBattle } from "@/lib/profile/progression";
import { DEFAULT_PLAYER_AVATAR_ID, normalizePlayerAvatarId } from "@/lib/profile/avatars";
import { getItemDefinition, ITEM_CATALOG, ITEM_SYSTEM_VERSION, migrateItemInventory } from "@/lib/items/catalog";
import { applyTournamentRewardReceipt } from "@/lib/tournament/rewards";
import { validateCompetitiveEvent, validateMasterReceipt } from "@/lib/ranking/results";

const DATABASE_NAME = "PokedExploreDB";
const DATABASE_VERSION = 4;
const SAVE_VERSION = 7;
const POKEDEX_STORE = "pokedex";
const PLAYER_STORE = "player";
const CACHE_STORE = "pokeapi-cache";
const ECONOMY_KEY = "economy";
const TRAINER_PROFILE_KEY = "trainer-profile";
const competitiveKey = (kind, playerId, matchId = "") => `${kind}:${encodeURIComponent(playerId)}:${encodeURIComponent(matchId)}`;
const competitiveOutboxKey = event => competitiveKey("competitive-outbox",event.playerId,`${event.completedAt}:${event.matchId}`);
const DECKS_KEY = "pokemon-decks";
const EMPTY_CREATOR_MODE = { infiniteCoins: false };
const EMPTY_ECONOMY = { key: ECONOMY_KEY, coins: 0, wagerReservations: {}, settledWagerIds: [], rewardedMatchIds: [], tournamentRewardReceipts: [], secretRewards: {}, inventory: {}, ownedTms: [], consumedItemActionIds: [], itemSystemVersion: ITEM_SYSTEM_VERSION, creatorMode: EMPTY_CREATOR_MODE };
const EMPTY_PROGRESS = { achievements: {}, streak: 0, bestStreak: 0, wins: 0, totalBattles: 0, processedOutcomeMatchIds: [], journeyCompleted: [], badges: [], journeyMedals: [], journeyPerfectRoutes: [], journeyRewardIds: [], activeExpedition: null, lastJourneyResult: null, trainerXp: 0, playerStats: null };
const normalizeEconomy = (economy) => {
  const savedProgress = economy?.progress || {};
  const progress = {
    ...EMPTY_PROGRESS,
    ...savedProgress,
    trainerXp: Math.max(0, Math.floor(Number(savedProgress.trainerXp) || 0)),
    achievements: { ...EMPTY_PROGRESS.achievements, ...(savedProgress.achievements || {}) },
    playerStats: normalizePlayerStats(savedProgress.playerStats, { legacyWins: savedProgress.wins, legacyBattles: savedProgress.totalBattles }),
  };
  // Version-1 Journey used "badges" locally. Convert only known Journey names;
  // competitive badges are a separate remote system and never enter this path.
  const legacyMedals = JOURNEY_MEDALS.filter((medal) => (savedProgress.journeyCompleted || []).includes(medal.routeId)).map((medal) => medal.id);
  progress.journeyMedals = [...new Set([...(savedProgress.journeyMedals || []), ...legacyMedals])];
  progress.journeyCompleted = [...new Set(savedProgress.journeyCompleted || [])];
  progress.journeyPerfectRoutes = [...new Set(savedProgress.journeyPerfectRoutes || [])];
  progress.journeyRewardIds = [...new Set(savedProgress.journeyRewardIds || [])].slice(-240);
  const legacy = Number(economy?.itemSystemVersion || 1) < ITEM_SYSTEM_VERSION;
  const inventoryEntries = Array.isArray(economy?.inventory) ? economy.inventory.map(entry => [entry?.itemId || entry?.id, entry?.quantity]) : Object.entries(economy?.inventory || {});
  const rawInventory = {};
  for (const [id, quantity] of inventoryEntries) if (id && Number.isFinite(Number(quantity)) && Number(quantity) > 0) rawInventory[id] = (rawInventory[id] || 0) + Math.floor(Number(quantity));
  const tournamentRewardReceipts = Array.isArray(economy?.tournamentRewardReceipts)
    ? economy.tournamentRewardReceipts.filter((receipt) => receipt?.id && receipt?.tournamentId && receipt?.playerId).slice(-240)
    : [];
  return normalizeDurableInventory({ ...EMPTY_ECONOMY, ...(economy || {}), itemSystemVersion: ITEM_SYSTEM_VERSION, tournamentRewardReceipts, secretRewards: { ...EMPTY_ECONOMY.secretRewards, ...(economy?.secretRewards || {}) }, inventory: legacy ? migrateItemInventory(rawInventory) : rawInventory, ownedTms: [...new Set(economy?.ownedTms || [])], creatorMode: { ...EMPTY_CREATOR_MODE, ...(economy?.creatorMode || {}), infiniteCoins: Boolean(economy?.creatorMode?.infiniteCoins) }, progress });
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB não está disponível neste ambiente."));
      return;
    }
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    let rejected = false;
    const timeout = setTimeout(() => { rejected = true; reject(new Error("Não foi possível abrir seu save. Feche outras abas do jogo e tente novamente.")); }, 10000);
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
    request.onsuccess = () => { clearTimeout(timeout); if (rejected) { request.result.close(); return; } request.result.onversionchange = () => request.result.close(); resolve(request.result); };
    request.onerror = () => { clearTimeout(timeout); reject(request.error); };
    request.onblocked = () => { rejected = true; clearTimeout(timeout); reject(new Error("Seu save está aberto em outra versão do jogo. Feche a outra aba e tente novamente.")); };
  });
}

async function migrateLocalStorage(database) {
  if (window.localStorage.getItem("PokedExploreIndexedDBMigrated")) return;
  let oldData = [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem("Pokedex"));
    oldData = Array.isArray(parsed) ? parsed : [];
  }
  catch (error) { console.error("Erro ao migrar a Pokédex antiga:", error); }
  if (oldData.length) await new Promise((resolve, reject) => {
    const transaction = database.transaction(POKEDEX_STORE, "readwrite");
    oldData
      .filter((pokemon) => pokemon?.id || pokemon?.instanceId || pokemon?.pokemonId || pokemon?.speciesId)
      .map(normalizeCapturedPokemon)
      .filter((pokemon) => pokemon?.id !== undefined && pokemon?.id !== null)
      .forEach((pokemon) => transaction.objectStore(POKEDEX_STORE).put(pokemon));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  window.localStorage.setItem("PokedExploreIndexedDBMigrated", "true");
}

async function withDatabase(callback) {
  const database = await openDatabase();
  try { await migrateLocalStorage(database); await migrateEquipmentDatabase(database); return await callback(database); }
  finally { database.close(); }
}

// A single atomic data migration in the existing stores, with a persisted marker.
async function migrateEquipmentDatabase(database) {
  await new Promise((resolve, reject) => {
    const tx = database.transaction([PLAYER_STORE, POKEDEX_STORE], "readwrite");
    const player = tx.objectStore(PLAYER_STORE), pokedex = tx.objectStore(POKEDEX_STORE);
    const request = player.get(ECONOMY_KEY);
    request.onsuccess = () => {
      if (request.result?.durableEquipmentVersion === DURABLE_EQUIPMENT_VERSION && request.result?.durableRepairVersion === DURABLE_REPAIR_VERSION) return;
      const records = pokedex.getAll();
      records.onsuccess = () => {
        try {
          const migrated = migrateDurableEquipment(normalizeEconomy(request.result), (records.result || []).map(normalizeCapturedPokemon));
          player.put(migrated.economy);
          migrated.collection.forEach(pokemon => pokedex.put(pokemon));
        } catch (error) { tx.abort(); reject(error); }
      };
    };
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}

export const webStore = {
  async prepareBattleTeam(pokemonIds) {
    if (!Array.isArray(pokemonIds) || pokemonIds.length !== 3 || new Set(pokemonIds.map(String)).size !== 3) throw new Error("Selecione três Pokémon diferentes.");
    return withDatabase(database => new Promise((resolve, reject) => {
      const tx = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite");
      const pokedex = tx.objectStore(POKEDEX_STORE);
      const rawTeam = Array(3); let savedEconomy; let completed = 0;
      const finish = () => {
        if (completed !== 4) return;
        try {
          const normalizedTeam = rawTeam.map(raw => raw ? normalizeCapturedPokemon(raw) : null);
          const relevantIds = normalizedTeam.flatMap(pokemon => EQUIPMENT_FIELDS.map(field => pokemon?.[field.instance]).filter(Boolean));
          const durableItems = Object.fromEntries([...new Set(relevantIds)].flatMap(id => savedEconomy?.durableItems?.[id] ? [[id, savedEconomy.durableItems[id]]] : []));
          // Startup migration already owns normalization of the complete save.
          // Preparation interprets only equipped copies, not all spare copies.
          const economy = { inventory: savedEconomy?.inventory || {}, durableItems, durableEquipmentVersion: savedEconomy?.durableEquipmentVersion, durableRepairVersion: savedEconomy?.durableRepairVersion, itemSystemVersion: savedEconomy?.itemSystemVersion };
          const team = normalizedTeam.map(pokemon => pokemon ? resolveDurableEquipment(pokemon, economy) : null);
          if (team.some(pokemon => !pokemon)) throw new Error("Um Pokémon selecionado não foi encontrado. Selecione sua equipe novamente.");
          team.forEach((pokemon, index) => { if (JSON.stringify(rawTeam[index]) !== JSON.stringify(pokemon)) pokedex.put(pokemon); });
          tx.result = { team, economy, diagnostics: { databaseVersion: DATABASE_VERSION, saveVersion: SAVE_VERSION, itemSystemVersion: economy.itemSystemVersion, durableEquipmentVersion: economy.durableEquipmentVersion, durableRepairVersion: economy.durableRepairVersion, pokemonReads: 3, economyReads: 1, itemInstancesProcessed: Object.keys(economy.durableItems).length } };
        } catch (error) { tx.abort(); reject(error); }
      };
      const request = tx.objectStore(PLAYER_STORE).get(ECONOMY_KEY);
      request.onsuccess = () => { savedEconomy = request.result; completed++; finish(); };
      pokemonIds.forEach((id, index) => { const request = pokedex.get(id); request.onsuccess = () => { rawTeam[index] = request.result; completed++; finish(); }; });
      tx.oncomplete = () => resolve(tx.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error("Não foi possível carregar sua equipe. Tente novamente."));
    }));
  },
  async getTrainerName() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(PLAYER_STORE, "readonly").objectStore(PLAYER_STORE).get(TRAINER_PROFILE_KEY);
        request.onsuccess = () => resolve(String(request.result?.name || "").trim() || "Treinador");
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao recuperar nome do treinador:", error); return "Treinador"; }
  },
  async getLocalPlayerProfile({ strict = false } = {}) {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        // Read/create identity in one serialized transaction. Concurrent mounts
        // cannot each read an empty profile and persist different player IDs.
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(TRAINER_PROFILE_KEY);
        request.onsuccess = () => {
          const saved = request.result || {};
          const profile = {
            playerId: saved.playerId || `player_${createUuid()}`,
            displayName: String(saved.name || "").trim() || "Treinador",
            avatarId: normalizePlayerAvatarId(saved.avatarId),
            createdAt: saved.createdAt || Date.now(),
          };
          store.put({ ...saved, key: TRAINER_PROFILE_KEY, playerId: profile.playerId, name: profile.displayName, avatarId: profile.avatarId, createdAt: profile.createdAt });
          transaction.result = profile;
        };
        request.onerror = () => reject(request.error);
        transaction.oncomplete = () => resolve(transaction.result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      }));
    } catch (error) {
      console.error("Erro ao recuperar perfil local:", error);
      if (strict) throw error;
      return { playerId: `player_${createUuid()}`, displayName: "Treinador", avatarId: DEFAULT_PLAYER_AVATAR_ID, createdAt: Date.now() };
    }
  },
  async setLocalPlayerProfile(profile) {
    const displayName = String(profile?.displayName || profile?.name || "").trim().slice(0, 18) || "Treinador";
    const playerId = String(profile?.playerId || `player_${createUuid()}`);
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
      playerId: `player_${createUuid()}`,
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
        request.onsuccess = () => store.put({ ...(request.result || {}), key: TRAINER_PROFILE_KEY, name: trainerName, playerId: request.result?.playerId || `player_${createUuid()}`, createdAt: request.result?.createdAt || Date.now(), updatedAt: Date.now() });
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
    const id = String(deck?.id || `deck_${createUuid()}`);
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
  async getEconomy({ strict = false } = {}) {
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
    } catch (error) { console.error("Erro ao recuperar moedas:", error); if (strict) throw error; return { ...EMPTY_ECONOMY }; }
  },
  async enqueueCompetitiveResult(event) {
    if (!validateCompetitiveEvent(event)) throw new Error("Resultado competitivo inválido.");
    const queued = await withDatabase(database => new Promise((resolve, reject) => {
      const tx = database.transaction(PLAYER_STORE, "readwrite"), store = tx.objectStore(PLAYER_STORE);
      const owner = store.get(TRAINER_PROFILE_KEY);
      owner.onsuccess = () => {
        if (owner.result?.playerId !== event.playerId) { tx.result = false; return; }
        const settled = store.get(competitiveKey("competitive-settlement", event.playerId, event.matchId));
        settled.onsuccess = () => {
          if (settled.result) { tx.result = false; return; }
          const key = competitiveOutboxKey(event);
          const pending = store.get(key);
          pending.onsuccess = () => {
            if (!pending.result) store.put({ key, event, queuedAt: Date.now() });
            tx.result = true;
          };
        };
      };
      tx.oncomplete = () => resolve(Boolean(tx.result));
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Não foi possível guardar o resultado."));
    }));
    if (queued && typeof window !== "undefined") window.dispatchEvent(new Event("competitive-outbox"));
    return queued;
  },
  async getPendingCompetitiveResults(playerId, limit = 30) {
    if (!playerId) return [];
    return withDatabase(database => new Promise((resolve, reject) => {
      const prefix = competitiveKey("competitive-outbox", playerId);
      const tx = database.transaction(PLAYER_STORE, "readonly");
      const request = tx.objectStore(PLAYER_STORE).getAll(IDBKeyRange.bound(prefix, `${prefix}\uffff`), limit);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    }));
  },
  async getCompetitiveSettlement(playerId, matchId) {
    return withDatabase(database => new Promise((resolve, reject) => {
      const request = database.transaction(PLAYER_STORE, "readonly").objectStore(PLAYER_STORE).get(competitiveKey("competitive-settlement", playerId, matchId));
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    }));
  },
  async recordPokemonMasterState(playerId, active) {
    const transition = await withDatabase(database => new Promise((resolve,reject) => {
      const tx=database.transaction(PLAYER_STORE,"readwrite"),store=tx.objectStore(PLAYER_STORE);
      const owner=store.get(TRAINER_PROFILE_KEY);
      owner.onsuccess=()=>{
        if(owner.result?.playerId!==playerId) return;
        const key=competitiveKey("pokemon-master-state",playerId);
        const previous=store.get(key);
        previous.onsuccess=()=>{tx.result=previous.result?.active===false && active===true;store.put({key,active:Boolean(active)});};
      };
      tx.oncomplete=()=>resolve(Boolean(tx.result));tx.onerror=tx.onabort=()=>reject(tx.error);
    }));
    if(transition) window.dispatchEvent(new CustomEvent("pokemon-master-achievement",{detail:{playerId}}));
    return transition;
  },
  async applyCompetitiveSettlement(event, response) {
    if (!validateCompetitiveEvent(event) || !response || (response.accepted !== true && response.duplicate !== true)
      || (response.receipt && !validateMasterReceipt(response.receipt, event))) throw new Error("Recibo competitivo inválido.");
    return withDatabase(database => new Promise((resolve, reject) => {
      const tx = database.transaction(PLAYER_STORE, "readwrite"), store = tx.objectStore(PLAYER_STORE);
      const owner = store.get(TRAINER_PROFILE_KEY);
      owner.onsuccess = () => {
        if (owner.result?.playerId !== event.playerId) { tx.result = { ownerChanged: true, applied: false }; return; }
        const economyRequest = store.get(ECONOMY_KEY);
        economyRequest.onsuccess = () => {
          const economy = normalizeEconomy(economyRequest.result);
          if (!Number.isSafeInteger(economy.coins) || economy.coins < 0) { tx.abort(); return; }
          const receipt = response.receipt;
          const apply = existing => {
            const applied = Boolean(receipt && !existing);
            const coins = economy.coins + (applied ? receipt.amount : 0);
            if (applied) {
              store.put(normalizeEconomy({ ...economy, coins }));
              // Permanent standalone record; NEVER truncated with the old reward arrays.
              store.put({ key: `competitive-reward:${receipt.id}`, playerId: event.playerId, receipt, appliedAt: Date.now() });
            }
            const settlement = { key: competitiveKey("competitive-settlement", event.playerId, event.matchId),
              matchId: event.matchId, playerId: event.playerId, receipt: receipt || null,
              masterBonus: receipt?.amount || 0, settledAt: Date.now() };
            store.put(settlement);
            store.delete(competitiveOutboxKey(event));
            tx.result = { ...settlement, applied, coins };
          };
          if (receipt) {
            const receiptRequest = store.get(`competitive-reward:${receipt.id}`);
            receiptRequest.onsuccess = () => apply(receiptRequest.result);
          } else apply(null);
        };
      };
      tx.oncomplete = () => resolve(tx.result);
      tx.onerror = tx.onabort = () => reject(tx.error || new Error("Não foi possível aplicar o recibo."));
    }));
  },
  async rewardVictory(matchId, amount, itemId = null) {
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
          const inventory = { ...economy.inventory };
          if (rewarded && itemId) inventory[itemId] = (inventory[itemId] || 0) + 1;
          const next = rewarded ? { ...economy, coins: economy.coins + amount, inventory, rewardedMatchIds: [...rewardedMatchIds, matchId].slice(-100) } : economy;
          if (rewarded) store.put(normalizeEconomy(next));
          transaction.result = { rewarded, coins: next.coins, itemId: rewarded ? itemId : null, infiniteCoins: Boolean(next.creatorMode?.infiniteCoins) };
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
          if (claimed) store.put(normalizeEconomy(next));
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
          pokedexStore.put(nextPokemon); playerStore.put(normalizeEconomy(nextEconomy));
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
  async getData(_key, { enrichRarity = true, strict = false } = {}) {
    try {
      const records = await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(POKEDEX_STORE, "readonly").objectStore(POKEDEX_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }));
      const equipmentEconomy = await this.getEconomy({ strict });
      const normalized = records.map(normalizeCapturedPokemon).map(pokemon => resolveDurableEquipment(pokemon, equipmentEconomy));
      const collection = enrichRarity ? await Promise.all(normalized.map((pokemon) => hasResolvedPokemonRarity(pokemon) ? pokemon : enrichPokemonRarity(pokemon))) : normalized;
      const needsMigration = records.some((record, index) =>
        record.saveVersion !== SAVE_VERSION ||
        record.abilityId !== collection[index].abilityId ||
        record.heldItem !== collection[index].heldItem ||
        record.elementalRelic !== collection[index].elementalRelic ||
        record.strategicItemInstanceId !== collection[index].strategicItemInstanceId ||
        record.elementalRelicInstanceId !== collection[index].elementalRelicInstanceId ||
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
    } catch (error) { console.error("Erro ao recuperar dados do IndexedDB:", error); if (strict) throw error; return []; }
  },
  async capturePokemon(pokemon) {
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(POKEDEX_STORE, "readwrite"); const store = transaction.objectStore(POKEDEX_STORE); const request = store.get(pokemon.id);
      request.onsuccess = () => { const existing = request.result ? normalizeCapturedPokemon(request.result) : null; const previousLevel = existing?.level || 0; const maxLevel = Boolean(existing && existing.level >= MAX_POKEMON_LEVEL); const next = existing ? { ...existing, level: Math.min(MAX_POKEMON_LEVEL, existing.level + 1) } : normalizeCapturedPokemon(pokemon); store.put(next); transaction.result = { pokemon: next, duplicate: Boolean(existing), previousLevel, maxLevel }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao capturar Pokémon:", error); return null; }
  },
  async settleTournamentReward(reward) {
    if (!reward?.id || !reward?.tournamentId || !reward?.playerId) return { rewarded: false, coins: 0, receipt: null };
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const settled = applyTournamentRewardReceipt(economy, reward);
          if (settled.applied) store.put(normalizeEconomy(settled.economy));
          transaction.result = {
            rewarded: settled.applied,
            coins: settled.economy.coins,
            inventory: settled.economy.inventory,
            receipt: settled.receipt,
          };
        };
        transaction.oncomplete = () => resolve(transaction.result || { rewarded: false, coins: 0, receipt: null });
        transaction.onerror = () => reject(transaction.error);
        request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao liquidar recompensa do campeonato:", error); return { rewarded: false, coins: 0, receipt: null }; }
  },
  async reserveWager(wagerId, amount) {
    const wager = Math.max(0, Math.floor(Number(amount) || 0));
    if (!wagerId || !wager) return { ok: false, reason: "invalid" };
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => { const economy = normalizeEconomy(request.result); const reservations = economy.wagerReservations || {}; if (reservations[wagerId]) { transaction.result = { ok: true, duplicate: true, coins: economy.coins }; return; } if (!economy.creatorMode?.infiniteCoins && economy.coins < wager) { transaction.result = { ok: false, reason: "insufficient", coins: economy.coins }; return; } const next = { ...economy, coins: economy.creatorMode?.infiniteCoins ? economy.coins : economy.coins - wager, wagerReservations: { ...reservations, [wagerId]: wager } }; store.put(normalizeEconomy(next)); transaction.result = { ok: true, coins: next.coins }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch { return { ok: false, reason: "persistence" }; }
  },
  async settleWager(wagerId, { won = false, refund = false } = {}) {
    if (!wagerId) return { settled: false };
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => { const economy = normalizeEconomy(request.result); const reservations = economy.wagerReservations || {}; const amount = reservations[wagerId]; const settled = economy.settledWagerIds || []; if (!amount || settled.includes(wagerId)) { transaction.result = { settled: false, coins: economy.coins }; return; } const payout = refund ? amount : won ? amount * 2 : 0; const next = { ...economy, coins: economy.creatorMode?.infiniteCoins ? economy.coins : economy.coins + payout, wagerReservations: Object.fromEntries(Object.entries(reservations).filter(([id]) => id !== wagerId)), settledWagerIds: [...settled, wagerId].slice(-100) }; store.put(normalizeEconomy(next)); transaction.result = { settled: true, coins: next.coins, payout }; };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch { return { settled: false }; }
  },
  async getCollectionSnapshot() {
    try {
      const records = await withDatabase((database) => new Promise((resolve, reject) => {
        const request = database.transaction(POKEDEX_STORE, "readonly").objectStore(POKEDEX_STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      }));
      const economy = await this.getEconomy();
      return records.map(normalizeCapturedPokemon).map(pokemon => resolveDurableEquipment(pokemon, economy));
    } catch (error) {
      console.error("Erro ao recuperar resumo da coleção:", error);
      return [];
    }
  },
  async getTrainerProfileSnapshot() {
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction([POKEDEX_STORE, PLAYER_STORE], "readwrite");
        const pokedexStore = transaction.objectStore(POKEDEX_STORE);
        const playerStore = transaction.objectStore(PLAYER_STORE);
        const collectionRequest = pokedexStore.getAll();
        const profileRequest = playerStore.get(TRAINER_PROFILE_KEY);
        const economyRequest = playerStore.get(ECONOMY_KEY);
        const decksRequest = playerStore.get(DECKS_KEY);
        let collection;
        let identity;
        let economy;
        let decks;
        const finish = () => {
          if (!collection || !identity || !economy || !decks) return;
          transaction.result = { identity, collection: collection.map(pokemon => resolveDurableEquipment(pokemon, economy)), economy, decks };
        };
        collectionRequest.onsuccess = () => { collection = (collectionRequest.result || []).map(normalizeCapturedPokemon); finish(); };
        profileRequest.onsuccess = () => {
          const saved = profileRequest.result || {};
          identity = { playerId: saved.playerId || `player_${createUuid()}`, displayName: String(saved.name || "").trim() || "Treinador", avatarId: normalizePlayerAvatarId(saved.avatarId), createdAt: saved.createdAt || Date.now() };
          finish();
        };
        economyRequest.onsuccess = () => {
          economy = normalizeEconomy(economyRequest.result);
          if (!economyRequest.result || Number(economyRequest.result.itemSystemVersion || 1) < ITEM_SYSTEM_VERSION) playerStore.put(economy);
          finish();
        };
        decksRequest.onsuccess = () => {
          decks = Array.isArray(decksRequest.result?.decks) ? decksRequest.result.decks.filter((deck) => deck?.id && Array.isArray(deck.pokemonIds)).map((deck) => ({ id: String(deck.id), name: String(deck.name || "Time sem nome").trim() || "Time sem nome", pokemonIds: deck.pokemonIds.map(String).slice(0, 3), createdAt: deck.createdAt || Date.now(), updatedAt: deck.updatedAt || Date.now() })) : [];
          finish();
        };
        transaction.oncomplete = () => resolve(transaction.result || { identity: null, collection: [], economy: normalizeEconomy(), decks: [] });
        transaction.onerror = () => reject(transaction.error);
        collectionRequest.onerror = () => reject(collectionRequest.error);
        profileRequest.onerror = () => reject(profileRequest.error);
        economyRequest.onerror = () => reject(economyRequest.error);
        decksRequest.onerror = () => reject(decksRequest.error);
      }));
    } catch (error) {
      console.error("Erro ao recuperar o perfil local:", error);
      return {
        identity: {
          playerId: `player_${createUuid()}`,
          displayName: "Treinador",
          avatarId: normalizePlayerAvatarId(),
          createdAt: Date.now(),
        },
        collection: [],
        economy: normalizeEconomy(),
        decks: [],
      };
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
          const next = normalizeEconomy(upgrade.category === "tm"
            ? { ...economy, coins: infiniteCoins ? economy.coins : economy.coins - totalPrice, ownedTms: [...economy.ownedTms, upgrade.id] }
            : { ...economy, coins: infiniteCoins ? economy.coins : economy.coins - totalPrice, inventory: { ...economy.inventory, [upgrade.id]: (economy.inventory[upgrade.id] || 0) + amount } });
          store.put(normalizeEconomy(next)); transaction.result = { ok: true, upgrade, quantity: amount, totalPrice, coins: next.coins, infiniteCoins, economy: next };
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
        request.onsuccess = () => { const economy = normalizeEconomy(request.result); if (consumptionId && economy.consumedItemActionIds?.includes(consumptionId)) { transaction.result = { ok: true, duplicate: true, economy }; return; } const inventory = { ...economy.inventory }; Object.entries(used).forEach(([id, quantity]) => { inventory[id] = Math.max(0, (inventory[id] || 0) - quantity); if (!inventory[id]) delete inventory[id]; }); const next = { ...economy, inventory, consumedItemActionIds: consumptionId ? [...(economy.consumedItemActionIds || []), consumptionId].slice(-100) : economy.consumedItemActionIds }; store.put(normalizeEconomy(next)); transaction.result = { ok: true, economy: next }; };
        transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
      }));
    } catch (error) { console.error("Erro ao consumir inventário:", error); return { ok: false }; }
  },
  async consumeHeldItem(pokemonId, heldItem, consumptionId) {
    if (!pokemonId || !heldItem) return { ok: false, reason: "invalid-item" };
    const inventoryId = getHeldItemInventoryId(heldItem);
    const definition = getItemDefinition(inventoryId);
    if (!inventoryId || definition?.usageType !== "HELD" || !definition.consumable)
      return { ok: false, reason: "invalid-item" };
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
          if ((pokemon.strategicItem || pokemon.heldItem) !== inventoryId) { transaction.result = { ok: false, reason: "not-equipped", economy, pokemon }; return; }
          const inventory = { ...economy.inventory };
          inventory[inventoryId] = Math.max(0, (inventory[inventoryId] || 0) - 1);
          if (!inventory[inventoryId]) delete inventory[inventoryId];
          const nextEconomy = { ...economy, inventory, consumedItemActionIds: consumptionId ? [...(economy.consumedItemActionIds || []), consumptionId].slice(-100) : economy.consumedItemActionIds };
          // A consumed automatic item is always strategic.  Keep the relic
          // reference intact so a later normalization cannot resurrect the item.
          const nextPokemon = { ...pokemon, strategicItem: null, heldItem: null };
          pokedexStore.put(nextPokemon);
          playerStore.put(normalizeEconomy(nextEconomy));
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
  async settleBattleItemConsumption(event) {
    if (!event || event.type !== "ITEM_CONSUMED" || !event.consumptionId)
      return { ok: false, reason: "invalid-consumption" };
    const definition = getItemDefinition(event.itemId);
    if (!definition?.consumable || definition.usageType !== event.usageType)
      return { ok: false, reason: "invalid-consumption" };
    if (event.usageType === "HELD" && (!event.equipmentSlot || event.equipmentSlot === "STRATEGIC"))
      return this.consumeHeldItem(event.pokemonInstanceId, event.itemId, event.consumptionId);
    if (event.usageType === "BAG")
      return this.consumeInventory({ [event.itemId]: 1 }, event.consumptionId);
    return { ok: false, reason: "invalid-consumption" };
  },
  async settleBattleEquipmentWear(state, localRole) {
    try {
      return await withDatabase(database => new Promise((resolve, reject) => {
        const tx = database.transaction([PLAYER_STORE, POKEDEX_STORE], "readwrite");
        const player = tx.objectStore(PLAYER_STORE), pokedex = tx.objectStore(POKEDEX_STORE);
        const economyRequest = player.get(ECONOMY_KEY), identityRequest = player.get(TRAINER_PROFILE_KEY), collectionRequest = pokedex.getAll();
        let economy, identity, collection;
        const finish = () => {
          if (!economy || !identity || !collection) return;
          if (identity.playerId !== state?.[localRole]?.id) { tx.result = { ok: false, reason: "wrong-owner" }; return; }
          // The committed snapshot was received at start, not reconstructed from current equipment.
          const journalId = `equipment-battle:${state.matchId}:${identity.playerId}`;
          const receipt = economy.equipmentWearReceipts?.[`equipment-wear:${state.matchId}:${identity.playerId}`];
          if (receipt) {
            player.delete(journalId);
            tx.result = { ok: true, applied: false, duplicate: true, changes: receipt.changes, economy, collection, updatedPokemon: [] };
            return;
          }
          const committedRequest = player.get(journalId);
          committedRequest.onsuccess = () => {
            const snapshot = committedRequest.result?.snapshot;
            if (!snapshot) { tx.result = { ok: false, reason: "missing-start-snapshot" }; return; }
            player.put({ key: journalId, snapshot, result: { matchId: state.matchId, status: state.status, winner: state.winner, performance: state.performance, [localRole]: { id: identity.playerId }, equipmentSnapshot: { [localRole]: snapshot } } });
            const result = settleEquipmentWear(economy, collection, { ...state, equipmentSnapshot: { [localRole]: snapshot } }, localRole);
            if (result.applied) { player.put(result.economy); result.updatedPokemon.forEach(pokemon => pokedex.put(pokemon)); }
            if (result.ok && state.status === "finished") player.delete(journalId);
            tx.result = result;
          };
        };
        economyRequest.onsuccess = () => { economy = normalizeEconomy(economyRequest.result); finish(); };
        identityRequest.onsuccess = () => { identity = identityRequest.result || {}; finish(); };
        collectionRequest.onsuccess = () => { collection = (collectionRequest.result || []).map(normalizeCapturedPokemon); finish(); };
        tx.oncomplete = () => resolve(tx.result || { ok: false }); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      }));
    } catch (error) { console.error("Erro ao salvar durabilidade:", error); return { ok: false, reason: "persistence" }; }
  },
  async commitBattleEquipment(state, localRole) {
    if (!state?.matchId || !state.equipmentSnapshot?.[localRole]) return { ok: false };
    return withDatabase(database => new Promise((resolve, reject) => {
      const tx = database.transaction(PLAYER_STORE, "readwrite"), store = tx.objectStore(PLAYER_STORE);
      const request = store.get(TRAINER_PROFILE_KEY);
      request.onsuccess = () => {
        const identity = request.result;
        if (!identity?.playerId || identity.playerId !== state[localRole]?.id) { tx.result = { ok: false }; return; }
        const key = `equipment-battle:${state.matchId}:${identity.playerId}`, saved = store.get(key);
        saved.onsuccess = () => {
          const snapshot = saved.result?.snapshot || state.equipmentSnapshot[localRole];
          const record = saved.result || { key, snapshot };
          if (state.status === "finished") record.result = { matchId: state.matchId, status: state.status, winner: state.winner, performance: state.performance, [localRole]: { id: identity.playerId }, equipmentSnapshot: { [localRole]: snapshot } };
          store.put(record); tx.result = { ok: true };
        };
      };
      tx.oncomplete = () => resolve(tx.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    }));
  },
  async getPendingEquipmentResults() {
    return withDatabase(database => new Promise((resolve, reject) => {
      const request = database.transaction(PLAYER_STORE, "readonly").objectStore(PLAYER_STORE).getAll(IDBKeyRange.bound("equipment-battle:", "equipment-battle:\uffff"));
      request.onsuccess = () => resolve((request.result || []).filter(record => record.key?.startsWith("equipment-battle:") && record.result).map(record => record.result));
      request.onerror = () => reject(request.error);
    }));
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
        const next = { ...economy, coins: economy.coins + rewardCoins, progress: nextProgress }; store.put(normalizeEconomy(next)); transaction.result = { recorded: true, progress: nextProgress, unlocked, rewardCoins, coins: next.coins };
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
  async startJourneyExpedition(routeId) {
    const route = getJourneyRoute(routeId);
    if (!route) return { ok: false, reason: "route" };
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => {
        const economy = normalizeEconomy(request.result); const previous = economy.progress.activeExpedition;
        if (!isJourneyNodeUnlocked(routeId, economy.progress.journeyCompleted, economy.progress.journeyMedals)) { transaction.result = { ok: false, reason: "locked" }; return; }
        const active = previous?.routeId === routeId && previous?.status !== "completed" ? previous : {
          runId: `journey_${createUuid()}`, routeId, currentBattle: 1, completedBattles: [], perfectRouteEligible: true, settledRewards: [], startedAt: Date.now(), status: "ready",
        };
        const next = { ...economy, progress: { ...economy.progress, activeExpedition: active } }; store.put(normalizeEconomy(next)); transaction.result = { ok: true, active };
      };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao iniciar expedição:", error); return { ok: false, reason: "persistence" }; }
  },
  async settleJourneyBattle({ routeId, battleIndex, matchId, won, perfectEligible = true }) {
    const route = getJourneyRoute(routeId); if (!route || !matchId) return { settled: false, reason: "invalid" };
    try { return await withDatabase((database) => new Promise((resolve, reject) => {
      const transaction = database.transaction(PLAYER_STORE, "readwrite"); const store = transaction.objectStore(PLAYER_STORE); const request = store.get(ECONOMY_KEY);
      request.onsuccess = () => {
        const economy = normalizeEconomy(request.result); const progress = economy.progress; const active = progress.activeExpedition;
        if (!active || active.routeId !== routeId || Number(active.currentBattle) !== Number(battleIndex)) { transaction.result = { settled: false, reason: "stale" }; return; }
        const battleKey = `journey-battle:${active.runId}:${battleIndex}`;
        if ((active.settledRewards || []).includes(battleKey)) { transaction.result = { settled: false, reason: "duplicate", active }; return; }
        const nextPerfect = Boolean(active.perfectRouteEligible && perfectEligible);
        if (!won) {
          const nextActive = { ...active, perfectRouteEligible: false, status: "ready" };
          const next = { ...economy, progress: { ...progress, activeExpedition: nextActive } }; store.put(normalizeEconomy(next)); transaction.result = { settled: true, won: false, active: nextActive }; return;
        }
        const firstClear = !progress.journeyCompleted.includes(routeId);
        const reward = resolveJourneyLoot({ route, battleIndex, runId: active.runId, firstClear });
        const inventory = { ...economy.inventory }; if (reward.itemId) inventory[reward.itemId] = (inventory[reward.itemId] || 0) + 1;
        const completedBattles = [...new Set([...(active.completedBattles || []), Number(battleIndex)])];
        let nextProgress = { ...progress, journeyRewardIds: [...progress.journeyRewardIds, reward.id].slice(-240) };
        let nextActive = { ...active, completedBattles, currentBattle: Number(battleIndex) + 1, perfectRouteEligible: nextPerfect, settledRewards: [...active.settledRewards, battleKey], status: Number(battleIndex) === 3 ? "chest" : "between-battles" };
        let chest = null; let medal = null;
        if (Number(battleIndex) === 3) {
          chest = resolveJourneyLoot({ route, battleIndex, runId: active.runId, firstClear, chest: true, perfect: nextPerfect });
          if (chest.itemId) inventory[chest.itemId] = (inventory[chest.itemId] || 0) + 1;
          nextProgress = { ...nextProgress, journeyCompleted: firstClear ? [...progress.journeyCompleted, routeId] : progress.journeyCompleted, journeyPerfectRoutes: nextPerfect && !progress.journeyPerfectRoutes.includes(routeId) ? [...progress.journeyPerfectRoutes, routeId] : progress.journeyPerfectRoutes, journeyRewardIds: [...nextProgress.journeyRewardIds, chest.id].slice(-240), lastJourneyResult: { routeId, reward, chest, perfect: nextPerfect, completedAt: Date.now() } };
          medal = route.medalId && !progress.journeyMedals.includes(route.medalId) ? route.medalId : null;
          if (medal) { nextProgress.journeyMedals = [...progress.journeyMedals, medal]; nextProgress.lastJourneyResult.medal = medal; }
          nextActive = { ...nextActive, status: "completed", completedAt: Date.now() };
        }
        const next = { ...economy, coins: economy.coins + reward.coins + (chest?.coins || 0), inventory, progress: { ...nextProgress, activeExpedition: nextActive } }; store.put(normalizeEconomy(next));
        transaction.result = { settled: true, won: true, reward, chest, medal, active: nextActive, coins: next.coins };
      };
      transaction.oncomplete = () => resolve(transaction.result); transaction.onerror = () => reject(transaction.error); request.onerror = () => reject(request.error);
    })); } catch (error) { console.error("Erro ao salvar recompensa da Jornada:", error); return { settled: false, reason: "persistence" }; }
  },
  // Compatibility for a pre-expedition battle URL. New Journey wins always use
  // settleJourneyBattle above, which owns reward ids and route completion.
  async completeJourneyNode(node) { return this.startJourneyExpedition(node?.id); },
  async setHeldItem(pokemonId, heldItem, slot) {
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
          const result = planHeldItemChange({ pokemonId, requestedItem: heldItem, economy, collection, slot });
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
  async setEquipmentItem(pokemonId, itemId, slot) { return this.setHeldItem(pokemonId, itemId, slot); },
  async setCoinBalance(value) {
    const coins = Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(Number(value) || 0)));
    try {
      return await withDatabase((database) => new Promise((resolve, reject) => {
        const transaction = database.transaction(PLAYER_STORE, "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const next = { ...normalizeEconomy(request.result), coins };
          store.put(normalizeEconomy(next));
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
          store.put(normalizeEconomy(next));
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
          store.put(normalizeEconomy(next));
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
          const reserved = collection.filter(pokemon => pokemon.strategicItem === item.id || pokemon.elementalRelic === item.id).length;
          if (quantity < reserved) {
            transaction.result = { ok: false, reason: "reserved", reserved, quantity: economy.inventory[item.id] || 0, economy };
            return;
          }
          const inventory = { ...economy.inventory };
          if (quantity > 0) inventory[item.id] = quantity;
          else delete inventory[item.id];
          const reservedIds = new Set(collection.flatMap(pokemon => EQUIPMENT_FIELDS.map(field => pokemon[field.instance]).filter(Boolean)));
          const next = resizeDurableInventory({ ...economy, inventory }, item.id, quantity, reservedIds);
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
        const transaction = database.transaction([PLAYER_STORE, POKEDEX_STORE], "readwrite");
        const store = transaction.objectStore(PLAYER_STORE);
        const request = store.get(ECONOMY_KEY);
        request.onsuccess = () => {
          const records = transaction.objectStore(POKEDEX_STORE).getAll();
          records.onsuccess = () => {
          const economy = normalizeEconomy(request.result);
          const inventory = { ...economy.inventory };
          ITEM_CATALOG.forEach((item) => {
            inventory[item.id] = preserveHigher ? Math.max(inventory[item.id] || 0, quantity) : quantity;
          });
          const collection = (records.result || []).map(normalizeCapturedPokemon);
          const reservedIds = new Set(collection.flatMap(pokemon => EQUIPMENT_FIELDS.map(field => pokemon[field.instance]).filter(Boolean)));
          let next = { ...economy, inventory };
          for (const item of ITEM_CATALOG) next = resizeDurableInventory(next, item.id, inventory[item.id], reservedIds);
          store.put(normalizeEconomy(next));
          transaction.result = next;
          };
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
          collectionRequest.onsuccess = () => (collectionRequest.result || []).map(normalizeCapturedPokemon).forEach(pokemon => pokedexStore.put(EQUIPMENT_FIELDS.reduce((next, field) => clearEquipmentSlot(next, field), pokemon)));
          economyRequest.onsuccess = () => playerStore.put({ ...normalizeEconomy(economyRequest.result), inventory: {}, durableItems: {} });
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

import { createUuid } from "@/lib/runtime/uuid";
