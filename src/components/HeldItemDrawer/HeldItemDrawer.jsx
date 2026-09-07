"use client";

import { CheckCircle, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { webStore } from "@/helpers/webStore";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import styles from "./HeldItemDrawer.module.scss";

const ITEMS = [
  { id: "oran", name: "Berry Oran", description: "Recupera 20% do HP automaticamente quando o HP cai para 50% ou menos." },
  { id: "sitrus", name: "Berry Sitrus", description: "Recupera 30% do HP automaticamente quando o HP cai para 50% ou menos." },
  { id: "type-boost", name: "Amplificador de tipo", description: "Aumenta em 10% os golpes do tipo principal deste Pokémon." },
];

const itemId = (item) => item?.endsWith("-boost") ? "type-boost" : item;
const itemInfo = (item) => ITEMS.find((entry) => entry.id === itemId(item));

export default function HeldItemDrawer({ pokemon, economy, heldItem, open, onClose, onEquipped }) {
  const [replacement, setReplacement] = useState(null);
  const [feedback, setFeedback] = useState("");
  const primaryType = pokemon.types?.[0]?.type?.name || pokemon.types?.[0] || "normal";

  useEffect(() => {
    if (!open) { setReplacement(null); setFeedback(""); }
  }, [open]);

  if (!open) return null;

  async function equip(item) {
    const result = await webStore.setHeldItem(pokemon.id, item);
    if (!result?.ok) return;
    const equipped = itemInfo(result.pokemon.heldItem);
    const message = equipped ? `${equipped.name.toUpperCase()} ${equipped.id === "type-boost" ? "EQUIPADO" : "EQUIPADA"}! ${pokemon.name} agora está segurando ${equipped.name}. ${equipped.id === "type-boost" ? "O amplificador fica ativo passivamente durante a batalha." : "Ela só será ativada após receber dano e ficar com 50% do HP ou menos."}` : "Item removido.";
    setReplacement(null);
    setFeedback(message);
    onEquipped(result.pokemon, message);
  }

  function choose(item) {
    if (item === heldItem) return;
    if (heldItem && item) { setReplacement(item); return; }
    void equip(item);
  }

  return <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="held-item-drawer-title">
      <header><div><span>ITEM SEGURADO</span><h2 id="held-item-drawer-title">Escolha um item</h2><p>{pokemon.name} · itens têm condições próprias de ativação.</p></div><button type="button" onClick={onClose} aria-label="Fechar seletor de item"><X size={21} /></button></header>
      {feedback ? <div className={styles.feedback} role="status"><CheckCircle size={21} weight="fill" /><span>{feedback}</span></div> : <div className={styles.list}>{ITEMS.map((item) => {
        const available = economy.inventory?.[item.id] || 0;
        const storedItem = item.id === "type-boost" ? `${primaryType}-boost` : item.id;
        const selected = heldItem === storedItem;
        return <article key={item.id} className={selected ? styles.selected : ""}><ItemSprite item={item.id} alt="" /><div><strong>{item.name}</strong><small>×{available} disponível</small><p>{item.description}</p></div><button type="button" disabled={(!available && !selected) || selected} onClick={() => choose(storedItem)}>{selected ? "Equipado" : "Equipar"}</button></article>;
      })}</div>}
      {!feedback && heldItem && <button type="button" className={styles.remove} onClick={() => void equip(null)}>Remover item</button>}
      {replacement && <div className={styles.confirm} role="alert"><strong>Trocar item?</strong><span>{itemInfo(heldItem)?.name} será substituído por {itemInfo(replacement)?.name}.</span><div><button type="button" onClick={() => setReplacement(null)}>Cancelar</button><button type="button" onClick={() => void equip(replacement)}>Trocar item</button></div></div>}
    </aside>
  </div>;
}
