"use client";

import { CheckCircle, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { webStore } from "@/helpers/webStore";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import { HELD_ITEM_CATALOG, getHeldItemDefinition, getHeldItemStock, toStoredHeldItem } from "@/lib/economy/heldItems";
import styles from "./HeldItemDrawer.module.scss";

const ERROR_MESSAGES = Object.freeze({
  "not-available": "Você não possui unidades disponíveis deste item.",
  "pokemon-not-found": "Não foi possível encontrar este Pokémon na sua coleção.",
  "invalid-item": "Este item não pode ser equipado.",
  persistence: "Não foi possível salvar o item. Tente novamente.",
});

export default function HeldItemDrawer({ pokemon, economy, collection, heldItem, open, onClose, onEquipped }) {
  const [replacement, setReplacement] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState({ economy: economy || { inventory: {} }, collection: collection || [] });

  useEffect(() => {
    if (!open) {
      setReplacement(null);
      setFeedback("");
      setError("");
      setBusy(false);
      return undefined;
    }
    let active = true;
    Promise.all([webStore.getData("Pokedex"), webStore.getEconomy()])
      .then(([currentCollection, currentEconomy]) => {
        if (active) setSnapshot({ collection: currentCollection, economy: currentEconomy });
      })
      .catch(() => { if (active) setError(ERROR_MESSAGES.persistence); });
    return () => { active = false; };
  }, [collection, economy, open]);

  if (!open) return null;

  async function equip(item) {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await webStore.setHeldItem(pokemon.id, item);
    setBusy(false);
    if (!result?.ok) {
      setError(ERROR_MESSAGES[result?.reason] || ERROR_MESSAGES.persistence);
      return;
    }
    const equipped = getHeldItemDefinition(result.pokemon.heldItem);
    const message = equipped
      ? `${equipped.name.toUpperCase()} ${equipped.id === "type-boost" ? "EQUIPADO" : "EQUIPADA"}! ${pokemon.name} agora está segurando ${equipped.name}. ${equipped.id === "type-boost" ? "O amplificador fica ativo passivamente durante a batalha." : "Ela só será ativada após receber dano e ficar com 50% do HP ou menos."}`
      : "Item removido.";
    setReplacement(null);
    setFeedback(message);
    setSnapshot({ collection: result.collection || snapshot.collection, economy: result.economy || snapshot.economy });
    onEquipped(result.pokemon, message, result);
  }

  function choose(item) {
    if (busy || item === heldItem) return;
    if (heldItem && item) { setReplacement(item); return; }
    void equip(item);
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
    <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="held-item-drawer-title">
      <header><div><span>ITEM EQUIPADO</span><h2 id="held-item-drawer-title">Escolha um item</h2><p>{pokemon.name} · itens têm condições próprias de ativação.</p></div><button type="button" onClick={onClose} disabled={busy} aria-label="Fechar seletor de item"><X size={21} /></button></header>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {feedback ? <div className={styles.feedback} role="status"><CheckCircle size={21} weight="fill" /><span>{feedback}</span></div> : <div className={styles.list}>{HELD_ITEM_CATALOG.map((item) => {
        const stock = getHeldItemStock({ economy: snapshot.economy, collection: snapshot.collection, itemId: item.id });
        const storedItem = toStoredHeldItem(item.id, pokemon);
        const selected = heldItem === storedItem;
        return <article key={item.id} className={selected ? styles.selected : ""}><ItemSprite item={item.id} alt="" /><div><strong>{item.name}</strong><small>Possui: {stock.owned} · Disponível: {stock.available}</small><p>{item.description}</p>{!selected && stock.available === 0 && <em>Nenhuma unidade livre para equipar.</em>}</div><button type="button" disabled={busy || selected || stock.available === 0} onClick={() => choose(storedItem)}>{busy ? "EQUIPANDO..." : selected ? "Equipado" : "Equipar"}</button></article>;
      })}</div>}
      {!feedback && heldItem && <button type="button" className={styles.remove} disabled={busy} onClick={() => void equip(null)}>{busy ? "REMOVENDO..." : "REMOVER ITEM"}</button>}
      {replacement && <div className={styles.confirm} role="alert"><strong>Trocar item?</strong><span>{getHeldItemDefinition(heldItem)?.name} será substituído por {getHeldItemDefinition(replacement)?.name}.</span><div><button type="button" disabled={busy} onClick={() => setReplacement(null)}>Cancelar</button><button type="button" disabled={busy} onClick={() => void equip(replacement)}>{busy ? "EQUIPANDO..." : "TROCAR ITEM"}</button></div></div>}
    </aside>
  </div>;
}
