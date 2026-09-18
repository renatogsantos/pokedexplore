"use client";

import Link from "next/link";
import { ArrowLeft, Backpack, Storefront } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { webStore } from "@/helpers/webStore";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import { ITEM_CATALOG, getRarityLabel, getRoleLabel, getUsageLabel } from "@/lib/items/catalog";
import { normalizePokemonHeldItem } from "@/lib/economy/heldItems";
import "./style.scss";

const FILTERS = [
  ["all", "Todos"],
  ["held", "Equipáveis"],
  ["bag", "Mochila"],
  ["artifact", "Artefatos"],
];

export default function InventoryPage() {
  const [economy, setEconomy] = useState({ inventory: {} });
  const [collection, setCollection] = useState([]);
  const [filter, setFilter] = useState("all");
  useEffect(() => { Promise.all([webStore.getEconomy(), webStore.getData("Pokedex")]).then(([nextEconomy, nextCollection]) => { setEconomy(nextEconomy); setCollection(nextCollection); }); }, []);
  const equipped = useMemo(() => collection.reduce((counts, pokemon) => { const id = normalizePokemonHeldItem(pokemon); if (id) counts[id] = (counts[id] || 0) + 1; return counts; }, {}), [collection]);
  const items = ITEM_CATALOG.filter((item) => (economy.inventory?.[item.id] || 0) > 0).filter((item) => filter === "all" || (filter === "held" && item.usageType === "HELD") || (filter === "bag" && item.usageType === "BAG") || (filter === "artifact" && item.category === "ARTIFACT"));
  const total = Object.values(economy.inventory || {}).reduce((sum, quantity) => sum + Number(quantity || 0), 0);

  return <main className="inventory-page">
    <header><Link href="/loja"><ArrowLeft size={20} /> Loja</Link><Link href="/loja"><Storefront size={20} /> Comprar itens</Link></header>
    <section className="inventory-hero"><div><span>COLEÇÃO DO TREINADOR</span><h1>Inventário</h1><p>Veja o que está livre, reservado em Pokémon e pronto para a Mochila.</p></div><strong><Backpack size={28} weight="fill" /> {total}<small>itens</small></strong></section>
    <nav className="inventory-filters" aria-label="Filtrar inventário">{FILTERS.map(([id, label]) => <button key={id} type="button" className={filter === id ? "selected" : ""} onClick={() => setFilter(id)}>{label}</button>)}</nav>
    {items.length ? <section className="inventory-grid" aria-live="polite">{items.map((item) => { const owned = economy.inventory[item.id] || 0; const reserved = item.usageType === "HELD" ? equipped[item.id] || 0 : 0; const available = Math.max(0, owned - reserved); return <article key={item.id} className={`rarity-${item.rarity.toLowerCase()}`}><ItemSprite item={item.id} alt={item.name} /><div><span>{getRarityLabel(item.rarity)} · {getUsageLabel(item.usageType)}</span><h2>{item.name}</h2><p>{item.shortDescription}</p><small>{getRoleLabel(item.role)}</small></div><dl><div><dt>Possui</dt><dd>{owned}</dd></div>{item.usageType === "HELD" && <><div><dt>Equipados</dt><dd>{reserved}</dd></div><div><dt>Disponíveis</dt><dd>{available}</dd></div></>}</dl></article>; })}</section> : <section className="inventory-empty"><Backpack size={42} /><h2>Nenhum item nesta seção</h2><p>Vença batalhas para ganhar moedas e descubra os itens na Loja.</p><Link href="/loja">IR PARA A LOJA</Link></section>}
  </main>;
}
