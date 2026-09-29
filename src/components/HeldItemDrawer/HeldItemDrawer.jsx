"use client";

import { X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import ItemDetailsModal from "@/components/ItemDetailsModal/ItemDetailsModal";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import { webStore } from "@/helpers/webStore";
import { EQUIPMENT_SLOT, getEquipableItemsForSlot, getEquipmentInventoryState, getHeldItemDefinition, getPokemonTypes } from "@/lib/economy/heldItems";
import styles from "./HeldItemDrawer.module.scss";

export default function HeldItemDrawer({ pokemon, economy, collection, heldItem, slot = EQUIPMENT_SLOT.STRATEGIC, open, onClose, onEquipped }) {
  const [snapshot, setSnapshot] = useState({ economy: economy || { inventory: {} }, collection: collection || [] });
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    Promise.all([webStore.getData("Pokedex"), webStore.getEconomy()])
      .then(([currentCollection, currentEconomy]) => setSnapshot({ collection: currentCollection, economy: currentEconomy }))
      .catch(() => setError("Não foi possível carregar o inventário."));
  }, [open, collection, economy]);

  const items = useMemo(() => getEquipableItemsForSlot({ pokemon, slot }), [pokemon, slot]);
  const states = useMemo(() => new Map(items.map((item) => [item.id, getEquipmentInventoryState({ economy: snapshot.economy, collection: snapshot.collection, pokemonId: pokemon?.id, itemId: item.id })])), [items, pokemon?.id, snapshot]);
  const selected = detail && getHeldItemDefinition(detail);
  const selectedState = selected && states.get(selected.id);

  if (!open) return null;

  const hasEquipableItem = items.some((item) => {
    const state = states.get(item.id);
    return state?.equippedOnCurrent || state?.available > 0;
  });
  const relicMessage = !items.length
    ? "Nenhuma relíquia compatível foi encontrada para os tipos deste Pokémon."
    : items.some((item) => states.get(item.id)?.owned > 0)
      ? "Suas relíquias compatíveis já estão equipadas."
      : "Você ainda não possui uma relíquia para este Pokémon.";

  if (process.env.NODE_ENV !== "production" && slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC) {
    console.debug("[Relic selector]", {
      pokemonInstanceId: pokemon?.id,
      rawTypes: pokemon?.types,
      normalizedTypes: getPokemonTypes(pokemon),
      catalogRelics: 18,
      compatibleRelics: items.map((item) => item.id),
      inventory: items.map((item) => states.get(item.id)),
      currentEquippedId: heldItem || null,
    });
  }

  async function equip(itemId) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await webStore.setEquipmentItem(pokemon.id, itemId, slot);
      if (!result?.ok) {
        setError(result?.reason === "TYPE_MISMATCH" ? "Esta relíquia não é compatível com o tipo deste Pokémon." : "Não foi possível equipar este item.");
        return;
      }
      setSnapshot({ collection: result.collection || snapshot.collection, economy: result.economy || snapshot.economy });
      onEquipped(result.pokemon, "Equipamento atualizado.", result);
      setDetail(null);
    } finally {
      setBusy(false);
    }
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="held-title">
      <header><div><span>{slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC ? "RELÍQUIA DE TIPO" : "ITEM ESTRATÉGICO"}</span><h2 id="held-title">Escolha um item</h2><p><b>EQUIPANDO EM</b> {pokemon.name}</p></div><button type="button" aria-label="Fechar seletor" onClick={onClose}><X size={21} /></button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {!error && slot === EQUIPMENT_SLOT.ELEMENTAL_RELIC && !hasEquipableItem && <p className={styles.error}>{relicMessage}</p>}
      <div className={styles.grid}>{items.map((item) => {
        const state = states.get(item.id);
        const equipped = state?.equippedOnCurrent;
        const unavailable = !equipped && state?.available === 0;
        return <article key={item.id} className={`${styles.card} ${equipped ? styles.selected : ""} ${unavailable ? styles.empty : ""}`} role="button" tabIndex={0} onClick={() => setDetail(item.id)} onKeyDown={(event) => { if (event.key === "Enter") setDetail(item.id); }}>
          <ItemSprite item={item.id} alt="" /><strong>{item.name}</strong><small>×{equipped ? state.owned : state.available}</small>{equipped && <em>✓ EQUIPADA</em>}
          <button type="button" disabled={busy || unavailable} onClick={(event) => { event.stopPropagation(); void equip(equipped ? null : item.id); }}>{equipped ? "DESEQUIPAR" : unavailable ? "×0" : "EQUIPAR"}</button>
        </article>;
      })}</div>
      {selected && <ItemDetailsModal item={selected} quantity={selectedState?.owned} available={selectedState?.available} actionLabel={selectedState?.equippedOnCurrent ? "DESEQUIPAR" : "EQUIPAR"} actionDisabled={busy || (!selectedState?.available && !selectedState?.equippedOnCurrent)} onAction={() => void equip(selectedState?.equippedOnCurrent ? null : selected.id)} onClose={() => setDetail(null)} />}
    </aside>
  </div>;
}
