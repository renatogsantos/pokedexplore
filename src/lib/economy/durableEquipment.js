import { ITEM_CATALOG, getItemDefinition, isDurableItem, migrateLegacyItemId } from "../items/catalog.js";

export const DURABLE_EQUIPMENT_VERSION = 1;
export const EQUIPMENT_FIELDS = Object.freeze([
  { slot: "STRATEGIC", item: "strategicItem", instance: "strategicItemInstanceId" },
  { slot: "ELEMENTAL_RELIC", item: "elementalRelic", instance: "elementalRelicInstanceId" },
]);

// quantity is retained as a compatibility aggregate, never a shared durability pool.
export function normalizeDurableInventory(economy = {}) {
  const inventory = { ...(economy.inventory || {}) };
  const durableItems = {};
  let durableSerial = Number.isFinite(Number(economy.durableSerial)) ? Math.max(0, Math.floor(Number(economy.durableSerial))) : 0;
  for (const [id, raw] of Object.entries(economy.durableItems || {})) {
    if (!raw || typeof raw !== "object") continue;
    const definition = getItemDefinition(raw.itemId);
    if (!isDurableItem(definition)) continue;
    const maxDurability = definition.durabilityMax;
    const durability = Math.min(maxDurability, Math.max(0, Math.floor(Number(raw.durability) || 0)));
    if (durability <= 0 && inventory[raw.itemId]) inventory[raw.itemId] = Math.max(0, inventory[raw.itemId] - 1);
    if (durability > 0) durableItems[id] = { ...raw, instanceId: id, maxDurability, durability };
  }
  const counts = {};
  Object.values(durableItems).forEach(copy => { counts[copy.itemId] = (counts[copy.itemId] || 0) + 1; });
  for (const item of ITEM_CATALOG.filter(isDurableItem)) {
    const owned = Number.isFinite(Number(inventory[item.id])) ? Math.max(0, Math.floor(Number(inventory[item.id]))) : 0;
    const missing = owned - (counts[item.id] || 0);
    for (let n = 0; n < missing; n += 1) {
      let instanceId;
      do { instanceId = `equipment:${++durableSerial}:${item.id}`; } while (durableItems[instanceId]);
      durableItems[instanceId] = { instanceId, itemId: item.id, durability: item.durabilityMax, maxDurability: item.durabilityMax };
    }
    const total = Math.max(owned, counts[item.id] || 0);
    if (total) inventory[item.id] = total;
    else delete inventory[item.id];
  }
  return { ...economy, inventory, durableItems, durableSerial };
}

export function bindEquipmentCopy(pokemon, field, copy) {
  const next = { ...pokemon, [field.instance]: copy?.instanceId || null, equipmentDurability: { ...(pokemon.equipmentDurability || {}) } };
  if (copy) next.equipmentDurability[field.slot] = { ...copy };
  else delete next.equipmentDurability[field.slot];
  return next;
}
export function clearEquipmentSlot(pokemon, field) {
  const next = bindEquipmentCopy({ ...pokemon, [field.item]: null }, field, null);
  if (field.slot === "STRATEGIC") next.heldItem = null;
  return next;
}
export function resolveDurableEquipment(pokemon, economy) {
  let next = pokemon;
  for (const field of EQUIPMENT_FIELDS) {
    if (!isDurableItem(next[field.item])) {
      if (next[field.instance] || next.equipmentDurability?.[field.slot]) next = bindEquipmentCopy(next, field, null);
      continue;
    }
    const copy = economy.durableItems?.[next[field.instance]];
    if (!copy || copy.itemId !== next[field.item] || copy.durability <= 0) {
      if (process.env.NODE_ENV !== "production") console.debug("[equipment] stale reference", { pokemonId: next.id, slot: field.slot, instanceId: next[field.instance] });
      next = clearEquipmentSlot(next, field);
    } else next = bindEquipmentCopy(next, field, copy);
  }
  return next;
}

export function migrateDurableEquipment(economy, collection) {
  const nextEconomy = normalizeDurableInventory(economy);
  const legacy = economy.durableEquipmentVersion !== DURABLE_EQUIPMENT_VERSION;
  const reserved = new Set();
  const copiesByItem = new Map();
  Object.values(nextEconomy.durableItems).forEach(copy => {
    if (!copiesByItem.has(copy.itemId)) copiesByItem.set(copy.itemId, []);
    copiesByItem.get(copy.itemId).push(copy);
  });
  const nextCollection = collection.map(pokemon => {
    let next = { ...pokemon };
    for (const field of EQUIPMENT_FIELDS) {
      if (!isDurableItem(next[field.item])) {
      if (next[field.instance] || next.equipmentDurability?.[field.slot]) next = bindEquipmentCopy(next, field, null);
      continue;
    }
      let copy = nextEconomy.durableItems[next[field.instance]];
      if (!copy && legacy) copy = (copiesByItem.get(next[field.item]) || []).find(entry => !reserved.has(entry.instanceId));
      if (!copy || copy.itemId !== next[field.item] || reserved.has(copy.instanceId)) next = clearEquipmentSlot(next, field);
      else { reserved.add(copy.instanceId); next = bindEquipmentCopy(next, field, copy); }
    }
    return next;
  });
  return { economy: { ...nextEconomy, durableEquipmentVersion: DURABLE_EQUIPMENT_VERSION }, collection: nextCollection };
}

export function getEquippedDurableInstances(team = []) {
  return team.flatMap(pokemon => EQUIPMENT_FIELDS.flatMap(field => {
    const copy = pokemon.equipmentDurability?.[field.slot];
    return isDurableItem(pokemon[field.item]) && copy?.instanceId === pokemon[field.instance] && copy.itemId === pokemon[field.item] && copy.durability > 0
      ? [{ ...copy, pokemonId: pokemon.instanceId || pokemon.id, slot: field.slot }] : [];
  }));
}
export function isEligibleForEquipmentWear(state, localRole) {
  return Boolean(state?.matchId && state.status === "finished" && ["host", "guest"].includes(state.winner) && state.performance?.startedAt && state.performance?.endedAt && state.performance.endedAt >= state.performance.startedAt && state[localRole]?.id && state[localRole].id !== "cpu" && state.equipmentSnapshot?.[localRole]);
}
export function settleEquipmentWear(economy, collection, state, localRole) {
  if (!isEligibleForEquipmentWear(state, localRole)) return { ok: true, applied: false, changes: [], economy, collection, updatedPokemon: [] };
  const matchId = state.matchId;
  const playerId = state[localRole].id;
  const receiptId = `equipment-wear:${matchId}:${playerId}`;
  const receipts = economy.equipmentWearReceipts || {};
  if (receipts[receiptId]) return { ok: true, applied: false, duplicate: true, changes: receipts[receiptId].changes, economy, collection, updatedPokemon: [] };
  const durableItems = { ...(economy.durableItems || {}) }, inventory = { ...economy.inventory };
  const changes = [], seen = new Set();
  for (const committed of state.equipmentSnapshot[localRole]) {
    if (seen.has(committed.instanceId)) continue;
    seen.add(committed.instanceId);
    const copy = durableItems[committed.instanceId];
    if (!copy || copy.itemId !== committed.itemId || copy.durability <= 0) continue;
    const durability = copy.durability - 1;
    const change = { ...committed, durabilityBefore: copy.durability, durabilityAfter: durability, broken: durability === 0 };
    changes.push(change);
    if (change.broken) {
      delete durableItems[copy.instanceId];
      inventory[copy.itemId] = Math.max(0, (inventory[copy.itemId] || 0) - 1);
      if (!inventory[copy.itemId]) delete inventory[copy.itemId];
    } else durableItems[copy.instanceId] = { ...copy, durability };
  }
  const changedIds = new Set(changes.map(change => change.instanceId));
  const updatedPokemon = [];
  const nextCollection = collection.map(pokemon => {
    let next = pokemon;
    for (const field of EQUIPMENT_FIELDS) {
      if (!changedIds.has(pokemon[field.instance])) continue;
      const copy = durableItems[pokemon[field.instance]];
      next = copy ? bindEquipmentCopy(next, field, copy) : clearEquipmentSlot(next, field);
    }
    if (next !== pokemon) updatedPokemon.push(next);
    return next;
  });
  const nextEconomy = { ...economy, durableItems, inventory, equipmentWearReceipts: { ...receipts, [receiptId]: { matchId, playerId, changes } } };
  return { ok: true, applied: true, changes, economy: nextEconomy, collection: nextCollection, updatedPokemon };
}

export function getEquipmentDurabilityLabel(pokemon, slot) {
  const copy = pokemon?.equipmentDurability?.[slot];
  return copy ? `${copy.durability}/${copy.maxDurability}${copy.durability === 1 ? " · ÚLTIMA BATALHA" : ""}` : "";
}

export function resizeDurableInventory(economy, itemId, quantity, reservedIds = new Set()) {
  if (!isDurableItem(itemId)) return normalizeDurableInventory(economy);
  const durableItems = { ...(economy.durableItems || {}) };
  const copies = Object.values(durableItems).filter(copy => copy.itemId === itemId);
  let remove = copies.length - quantity;
  for (const copy of copies) {
    if (remove <= 0) break;
    if (!reservedIds.has(copy.instanceId)) { delete durableItems[copy.instanceId]; remove -= 1; }
  }
  return normalizeDurableInventory({ ...economy, durableItems });
}
