"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CaretLeft, CaretRight, CheckCircle, MagnifyingGlass, ShoppingCart, Sparkle, X } from "@phosphor-icons/react";
import { webStore } from "@/helpers/webStore";
import { pokemonData } from "@/helpers/PokemonTypes";
import { actAddPokedex } from "@/redux/pokemons";
import { actCoins } from "@/redux/economy";
import { getPokemonPrice, getPurchaseLabel } from "@/lib/economy";
import { enrichPokemonRarity, getPokemonRarity } from "@/lib/pokemon/rarity";
import { getPokemonLevel, MAX_POKEMON_LEVEL } from "@/lib/pokemon/progression";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import CoinBalance from "@/components/CoinBalance";

const SHOP_PAGE_SIZE = 12;
const artwork = (pokemon) => pokemon?.sprites?.other?.["official-artwork"]?.front_default || pokemon?.sprites?.front_default || "/pokenull.png";
const typesOf = (pokemon) => pokemon?.types?.map((entry) => entry.type?.name || entry.name).filter(Boolean) || [];
const Coin = ({ className = "" }) => <img className={`coin-image ${className}`} src="/coin.png" alt="" aria-hidden="true" />;

function ShopCard({ pokemon, owned, balance, onBuy }) {
  const price = getPokemonPrice(pokemon); const level = owned ? getPokemonLevel(owned) : 0; const maxLevel = level >= MAX_POKEMON_LEVEL;
  const primary = typesOf(pokemon)[0] || "normal"; const color = pokemonData.find((item) => item.type === primary)?.color || "#64748b";
  const label = getPurchaseLabel({ balance, price, level, maxLevel });
  return <article className={`shop-card ${getRarityClassName(pokemon)}`} style={{ "--shop-type": color }}>
    <div className="shop-card-head"><span>#{String(pokemon.id).padStart(3, "0")}</span><PokemonRarity pokemon={pokemon} compact /></div>
    <img src={artwork(pokemon)} alt={pokemon.name} loading="lazy" />
    <h2>{pokemon.name}</h2><div className="shop-types">{typesOf(pokemon).map((type) => <span key={type}>{type}</span>)}</div>
    {owned && <p className="shop-owned"><Sparkle weight="fill" aria-hidden="true" /> Lv. {level} {maxLevel ? "· nível máximo" : "· comprar aumenta 1 nível"}</p>}
    <div className="shop-price"><Coin /><strong>{price}</strong></div>
    <button type="button" disabled={maxLevel} onClick={() => onBuy({ pokemon, price, owned, maxLevel })}><ShoppingCart size={18} weight="fill" aria-hidden="true" /> {label}</button>
  </article>;
}

function ShopPagination({ page, totalPages, disabled, onPageChange }) {
  const [input, setInput] = useState(String(page));
  useEffect(() => setInput(String(page)), [page]);
  const submitPage = () => { const next = Number(input); if (Number.isInteger(next)) onPageChange(Math.min(totalPages, Math.max(1, next))); else setInput(String(page)); };
  return <nav className="shop-pagination" aria-label="Paginação da loja">
    <button type="button" disabled={disabled || page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Página anterior"><CaretLeft size={20} weight="bold" /> Anterior</button>
    <label>Página <input type="text" inputMode="numeric" pattern="[0-9]*" value={input} onChange={(event) => setInput(event.target.value.replace(/\D/g, ""))} onBlur={submitPage} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); submitPage(); } }} aria-label={`Página atual, de ${totalPages}`} /> <span>de {totalPages}</span></label>
    <button type="button" disabled={disabled || page >= totalPages} onClick={() => onPageChange(page + 1)}>Próxima <CaretRight size={20} weight="bold" /></button>
  </nav>;
}

export default function Shop() {
  const dispatch = useDispatch(); const collection = useSelector((state) => state.pokemons.Pokedex) || []; const balance = useSelector((state) => state.economy.coins);
  const [query, setQuery] = useState(""); const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [rarity, setRarity] = useState("all"); const [sort, setSort] = useState("number"); const [selected, setSelected] = useState(null); const [feedback, setFeedback] = useState(null); const [page, setPage] = useState(1); const [total, setTotal] = useState(0);
  const cache = useRef(new Map()); const results = useRef(null);
  const totalPages = Math.max(1, Math.ceil(total / SHOP_PAGE_SIZE)); const searching = Boolean(query.trim());
  const loadPokemon = async (name) => {
    const key = name.trim().toLowerCase(); if (!key) return null; if (cache.current.has(key)) return cache.current.get(key);
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(key)}`); if (!response.ok) throw new Error("not-found");
    const pokemon = await enrichPokemonRarity(await response.json()); cache.current.set(key, pokemon); return pokemon;
  };
  useEffect(() => { webStore.getData("Pokedex").then((data) => dispatch(actAddPokedex(data))); webStore.getEconomy().then((data) => dispatch(actCoins(data.coins))); }, [dispatch]);
  useEffect(() => {
    const defaultOption = document.querySelector('.shop-controls select option[value="price-asc"]');
    if (defaultOption) defaultOption.textContent = sort === "number" ? "Número Pokédex" : "Menor preço";
  }, [sort]);
  useEffect(() => {
    let active = true;
    const request = async () => {
      setLoading(true);
      try {
        if (query.trim()) {
          const pokemon = await loadPokemon(query).catch(() => null);
          if (active) { setItems(pokemon ? [pokemon] : []); setTotal(pokemon ? 1 : 0); }
          return;
        }
        const offset = (page - 1) * SHOP_PAGE_SIZE;
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${SHOP_PAGE_SIZE}`);
        if (!response.ok) throw new Error("catalog-unavailable");
        const catalog = await response.json();
        const pokemon = await Promise.all(catalog.results.map((entry) => loadPokemon(entry.name).catch(() => null)));
        if (active) { setItems(pokemon.filter(Boolean)); setTotal(catalog.count || 0); }
      } catch { if (active) { setItems([]); setTotal(0); } }
      finally { if (active) setLoading(false); }
    };
    const timer = setTimeout(request, query.trim() ? 350 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [page, query]);
  const visible = useMemo(() => items.filter((pokemon) => rarity === "all" || getPokemonRarity(pokemon) === rarity).sort((a, b) => sort === "number" ? a.id - b.id : sort === "name" ? a.name.localeCompare(b.name) : sort === "price-desc" ? getPokemonPrice(b) - getPokemonPrice(a) : getPokemonPrice(a) - getPokemonPrice(b)), [items, rarity, sort]);
  const changePage = (next) => { setPage(Math.min(totalPages, Math.max(1, next))); results.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const changeQuery = (value) => { setQuery(value); setPage(1); };
  async function confirmPurchase() { if (!selected) return; const result = await webStore.purchasePokemon(selected.pokemon, selected.price); if (!result.ok) { setFeedback(result.reason === "insufficient" ? "Você ainda não tem moedas suficientes." : result.reason === "max-level" ? "Este Pokémon já está no nível máximo." : "Não foi possível concluir a compra."); setSelected(null); return; } dispatch(actCoins(result.coins)); dispatch(actAddPokedex(await webStore.getData("Pokedex"))); setFeedback(result.duplicate ? `${result.pokemon.name.toUpperCase()} subiu do nível ${result.previousLevel} para o ${result.pokemon.level}!` : `${result.pokemon.name.toUpperCase()} agora faz parte da sua Pokédex!`); setSelected(null); }
  return <main className="shop-page"><a className="shop-skip" href="#shop-results">Ir para os Pokémon</a><header className="shop-header"><Link href="/pokedex"><ArrowLeft size={20} aria-hidden="true" /> Pokédex</Link><div><Link href="/como-jogar">Como jogar</Link><CoinBalance /></div></header><div className="shop-shell"><section className="shop-hero"><div><span>LOJA POKÉMON</span><h1>Escolha seu próximo parceiro.</h1><p>Vença batalhas, junte moedas e fortaleça sua coleção do seu jeito.</p></div><div className="shop-balance"><Coin /><span>SEU SALDO</span><strong>{balance}</strong><small>moedas</small></div></section><section className="shop-browser"><label className="shop-search"><MagnifyingGlass size={22} aria-hidden="true" /><span className="sr-only">Pesquisar Pokémon</span><input type="search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Pesquisar Pokémon: Pikachu, Charizard..." autoComplete="off" /></label><div className="shop-controls"><div role="group" aria-label="Filtrar raridade nesta página"><button type="button" className={rarity === "all" ? "selected" : ""} onClick={() => setRarity("all")}>Todos</button><button type="button" className={rarity === "legendary" ? "selected" : ""} onClick={() => setRarity("legendary")}>Lendários</button><button type="button" className={rarity === "mythical" ? "selected" : ""} onClick={() => setRarity("mythical")}>Míticos</button></div><label>Ordenar<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">A–Z</option></select></label></div><div className="shop-catalog-heading"><div><span>{searching ? "RESULTADO DA BUSCA" : "CATÁLOGO COMPLETO"}</span><strong>{searching ? "Resultado exato" : `Página ${page} de ${totalPages}`}</strong></div>{!searching && <small>{total || "…"} Pokémon disponíveis</small>}</div><div id="shop-results" ref={results} className="shop-grid" aria-live="polite" aria-busy={loading}>{loading ? <p className="shop-loading">Preparando a vitrine…</p> : visible.length ? visible.map((pokemon) => <ShopCard key={pokemon.id} pokemon={pokemon} balance={balance} owned={collection.find((item) => item.id === pokemon.id)} onBuy={setSelected} />) : <p className="shop-empty">{rarity === "all" ? "Não encontramos este Pokémon. Tente outro nome." : "Nenhum Pokémon desta raridade nesta página."}</p>}</div>{!searching && <ShopPagination page={page} totalPages={totalPages} disabled={loading || total === 0} onPageChange={changePage} />}</section></div><AnimatePresence>{selected && <motion.div className="shop-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="shop-modal" role="dialog" aria-modal="true" aria-labelledby="shop-confirm-title" initial={{ y: 16, scale: .97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 16, scale: .97 }}><button type="button" className="shop-modal-close" onClick={() => setSelected(null)} aria-label="Cancelar compra"><X size={20} /></button><img src={artwork(selected.pokemon)} alt="" /><span>CONFIRMAR COMPRA</span><h2 id="shop-confirm-title">{selected.pokemon.name}</h2><p>{selected.owned ? "Este Pokémon sobe 1 nível na sua coleção." : "Adicionar este Pokémon à sua coleção?"}</p><strong><Coin /> {selected.price} moedas</strong><div><button type="button" onClick={() => setSelected(null)}>Cancelar</button><button type="button" onClick={confirmPurchase}>Comprar agora</button></div></motion.section></motion.div>}</AnimatePresence><AnimatePresence>{feedback && <motion.div className="shop-feedback" role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}><CheckCircle size={22} weight="fill" /><span>{feedback}</span><button type="button" onClick={() => setFeedback(null)} aria-label="Fechar mensagem"><X size={18} /></button></motion.div>}</AnimatePresence></main>;
}
