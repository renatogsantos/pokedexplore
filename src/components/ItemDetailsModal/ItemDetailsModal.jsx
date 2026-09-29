"use client";

import { X } from "@phosphor-icons/react";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import {
  getItemUsagePresentation,
  getRarityLabel,
  getRoleLabel,
} from "@/lib/items/catalog";
import styles from "./ItemDetailsModal.module.scss";

function DetailRow({ label, value }) {
  if (!value) return null;
  return <section><b>{label}</b><p>{value}</p></section>;
}

export default function ItemDetailsModal({
  item,
  quantity = 0,
  available,
  actionLabel,
  actionDisabled = false,
  onAction,
  onClose,
}) {
  if (!item) return null;
  const presentation = getItemUsagePresentation(item);
  const isTm = item.category === "tm";
  const isRelic = item.equipmentSlot === "ELEMENTAL_RELIC";
  const classifications = presentation
    ? `${getRarityLabel(item.rarity)} · ${presentation.usageLabel} · ${presentation.persistenceLabel}`
    : `TM · ${item.quantityLabel || "PERMANENTE"}`;
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`${styles.modal} ${styles[`rarity${String(item.rarity || "").toLowerCase()}`] || ""}`} role="dialog" aria-modal="true" aria-labelledby="item-details-title">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar detalhes"><X size={20} /></button>
        <ItemSprite item={item.id} alt="" className={styles.sprite} />
        <span className={styles.classifications}>{classifications}</span>
        <h2 id="item-details-title">{item.name}</h2>
        <small className={styles.stock}>Possui: {quantity}{available != null ? ` · Disponível: ${available}` : ""}</small>
        {Number.isFinite(Number(item.price)) && <strong className={styles.price}><img src="/coin.png" alt="" aria-hidden="true" /> {item.price}</strong>}
        <DetailRow label="EFEITO" value={presentation?.effectLabel || item.description || item.shortDescription} />
        <DetailRow label="ATIVAÇÃO" value={presentation?.triggerLabel || (isTm ? "Ensina este golpe permanentemente à sua coleção." : null)} />
        <DetailRow label="CONSUMO" value={presentation?.afterUseLabel || (isTm ? "Depois de adquirida, a TM permanece na sua coleção." : null)} />
        {isRelic && <DetailRow label="RELÍQUIA DE TIPO" value={`Tipo: ${item.elementalType}`} />}
        {item.role && <DetailRow label="IDEAL PARA" value={getRoleLabel(item.role)} />}
        {onAction && <button type="button" className={styles.action} disabled={actionDisabled} onClick={onAction}>{actionLabel}</button>}
      </section>
    </div>
  );
}
