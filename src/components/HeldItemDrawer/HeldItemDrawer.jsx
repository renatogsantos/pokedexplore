"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ItemDetailsModal from "@/components/ItemDetailsModal/ItemDetailsModal";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import { webStore } from "@/helpers/webStore";
import { EQUIPMENT_SLOT, buildEquipmentReservationIndex, getEquipmentItemStates, getPokemonTypes, planHeldItemChange } from "@/lib/economy/heldItems";
import styles from "./HeldItemDrawer.module.scss";

const measure = (name, startedAt, details = {}) => {
  if (process.env.NODE_ENV !== "production") console.debug("[item-performance]", { name, durationMs: Math.round((performance.now() - startedAt) * 10) / 10, ...details });
};

export default function HeldItemDrawer({ pokemon, economy, collection, slot = EQUIPMENT_SLOT.STRATEGIC, open, onClose, onEquipped }) {
  const [detail, setDetail] = useState(null);
  const [pendingItemId, setPendingItemId] = useState(null);
  const [error, setError] = useState("");
  const operation = useRef(0);
  const openedAt = useRef(null);
  if (open && !openedAt.current) openedAt.current = performance.now();
  if (!open && openedAt.current) openedAt.current = null;

  const reservationIndex = useMemo(() => buildEquipmentReservationIndex(collection), [collection]);
  const itemStates = useMemo(() => getEquipmentItemStates({ economy, collection, pokemon, slot, reservationIndex }), [economy, collection, pokemon, slot, reservationIndex]);
  const selected = detail ? itemStates.find((entry) => entry.selectionId === detail) : null;
  useEffect(() => {
    if (!open || process.env.NODE_ENV === "production") return;
    console.debug("[equipment-selector]", itemStates.flatMap(state => (state.instances || []).map(copy => ({
      itemId: state.item.id, instanceId: copy.instanceId, durability: copy.durability, maxDurability: copy.maxDurability,
      equippedPokemonId: collection.find(entry => entry.strategicItemInstanceId === copy.instanceId || entry.elementalRelicInstanceId === copy.instanceId)?.id || null,
      slot, source: "economy.durableItems"
    }))));
  }, [open, itemStates, collection, slot]);


  if (!open) return null;
  if (openedAt.current) {
    measure(slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? "OPEN_RELIC_SELECTOR" : "OPEN_STRATEGIC_SELECTOR", openedAt.current, { compatibleItems: itemStates.length, collectionSize: collection.length });
    openedAt.current = null;
  }

  const hasEquipableItem = itemStates.some((state) => state.equippedOnCurrent || state.available > 0);
  const relicMessage = !itemStates.length ? "Nenhuma relíquia compatível foi encontrada para os tipos deste Pokémon." : itemStates.some((state) => state.owned > 0) ? "Suas relíquias compatíveis já estão equipadas." : "Você ainda não possui uma relíquia para este Pokémon.";

  if (process.env.NODE_ENV !== "production" && slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC) {
    console.debug("[Relic selector]", { pokemonInstanceId: pokemon?.id, rawTypes: pokemon?.types, normalizedTypes: getPokemonTypes(pokemon), catalogRelics: 18, compatibleRelics: itemStates.map(({ item }) => item.id), inventory: itemStates, currentEquippedId: pokemon?.elementalRelic || null });
  }

  async function equip(itemId, instanceId) {
    const requestedItem = instanceId ? { id: itemId, instanceId } : itemId;
    if (pendingItemId) return;
    const startedAt = performance.now();
    const previousCollection = collection;
    const plan = planHeldItemChange({ pokemonId: pokemon.id, requestedItem, economy, collection, slot });
    if (!plan.ok) {
      setError(plan.reason === "TYPE_MISMATCH" ? "Esta relíquia não é compatível com o tipo deste Pokémon." : "Não foi possível equipar este item.");
      return;
    }
    const operationId = ++operation.current;
    setPendingItemId(instanceId || itemId || "__unequip__");
    setError("");
    // The visible team updates before IndexedDB work. The store repeats the
    // validation inside its single transaction; failure restores this snapshot.
    onEquipped(plan.pokemon, "Equipamento atualizado.", { economy, collection: plan.collection, optimistic: true });
    try {
      const result = await webStore.setEquipmentItem(pokemon.id, requestedItem, slot);
      if (operationId !== operation.current) return;
      if (!result?.ok) {
        const previousPokemon = previousCollection.find((entry) => String(entry.id) === String(pokemon.id));
        if (previousPokemon) onEquipped(previousPokemon, "", { economy, collection: previousCollection, rollback: true });
        setError("Não foi possível equipar o item. Tente novamente.");
        return;
      }
      onEquipped(result.pokemon, "Equipamento atualizado.", result);
      setDetail(null);
      measure(itemId ? (slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? "EQUIP_RELIC" : "EQUIP_STRATEGIC") : "UNEQUIP", startedAt, { persisted: true });
    } catch {
      if (operationId === operation.current) {
        const previousPokemon = previousCollection.find(entry => String(entry.id) === String(pokemon.id));
        if (previousPokemon) onEquipped(previousPokemon, "", { economy, collection: previousCollection, rollback: true });
        setError("Não foi possível salvar o equipamento. Tente novamente.");
      }
    } finally {
      if (operationId === operation.current) setPendingItemId(null);
    }
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="held-title">
      <header><div><span>{slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? "RELÍQUIA DE TIPO" : "ITEM ESTRATÉGICO"}</span><h2 id="held-title">Escolha um item</h2><p><b>EQUIPANDO EM</b> {pokemon.name}</p></div><button type="button" aria-label="Fechar seletor" onClick={onClose}><X size={21} /></button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!error && slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC && !hasEquipableItem && <p className={styles.error}>{relicMessage}</p>}
      <div className={styles.grid}>{itemStates.map((state) => {
        const { item, equippedOnCurrent: equipped } = state;
        const unavailable = !equipped && state.available === 0;
        const pending = pendingItemId === (state.copy?.instanceId || state.selectionId) || (pendingItemId === "__unequip__" && equipped);
        return <article key={state.selectionId} className={`${styles.card} ${equipped ? styles.selected : ""} ${unavailable ? styles.empty : ""}`} role="button" tabIndex={0} onClick={() => setDetail(state.selectionId)} onKeyDown={(event) => { if (event.key === "Enter") setDetail(state.selectionId); }}>
          <span className={styles.quantity} aria-label={`${state.owned} cópias possuídas`}>×{state.owned}</span><ItemSprite item={item.id} alt="" /><strong>{item.name}</strong><small>{state.copy ? `${equipped ? "◆" : "Próximo:"} ${state.copy.durability}/${state.copy.maxDurability}` : `${state.available} disponíveis`}</small>{state.copy?.durability === 1 && <em>ÚLTIMA BATALHA</em>}{equipped && <em>✓ EQUIPADA</em>}
          <button type="button" disabled={Boolean(pendingItemId) || unavailable} onClick={(event) => { event.stopPropagation(); void equip(equipped ? null : item.id, equipped ? null : state.copy?.instanceId); }}>{pending ? "EQUIPANDO..." : equipped ? "DESEQUIPAR" : unavailable ? "×0" : "EQUIPAR"}</button>
        </article>;
      })}</div>
      {selected && <ItemDetailsModal item={selected.item} instance={selected.copy} quantity={selected.owned} available={selected.available} equipped={selected.equipped} actionLabel={selected.equippedOnCurrent ? "DESEQUIPAR" : "EQUIPAR"} actionDisabled={Boolean(pendingItemId) || (!selected.available && !selected.equippedOnCurrent)} onAction={() => void equip(selected.equippedOnCurrent ? null : selected.item.id, selected.equippedOnCurrent ? null : selected.copy?.instanceId)} onClose={() => setDetail(null)} />}
    </aside>
  </div>;
}
