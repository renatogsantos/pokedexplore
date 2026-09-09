"use client";

import {
  CheckCircle,
  FloppyDisk,
  GameController,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Star,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getPokemonArtwork, getPokemonType } from "@/lib/battle/pokemon";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { pokemonData } from "@/helpers/PokemonTypes";
import PokemonPagination from "@/components/PokemonPagination";
import useThreeRowPagination from "@/hooks/useThreeRowPagination";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import PokemonAura from "@/components/PokemonAura/PokemonAura";
import HeldItemDrawer from "@/components/HeldItemDrawer/HeldItemDrawer";
import { webStore } from "@/helpers/webStore";
import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";

function TypeBadge({ type }) {
  return (
    <span className="battle-collection-type">
      <img src={`/types/${type}.svg`} alt="" />
      {type}
    </span>
  );
}

function HeldItemBadge({ item, compact = false }) {
  if (!item) return compact ? null : <span className="battle-held-item empty">SEM ITEM</span>;
  const label = item === "oran" ? "Berry Oran" : item === "sitrus" ? "Berry Sitrus" : "Amplificador";
  return <span className={`battle-held-item ${compact ? "compact" : ""}`}><ItemSprite item={item} alt="" className="battle-held-item-sprite" />{!compact && `${label} · EQUIPADO`}</span>;
}

export default function TeamSelector({
  collection,
  selected,
  onToggle,
  onReady,
  waiting,
  canReady = true,
  onEquipmentChanged,
  onUseDeck,
}) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [page, setPage] = useState(1);
  const [economy, setEconomy] = useState({ inventory: {} });
  const [equipmentPokemon, setEquipmentPokemon] = useState(null);
  const [activeTab, setActiveTab] = useState("pokemon");
  const [decks, setDecks] = useState([]);
  const { pageSize } = useThreeRowPagination({
    selector: ".battle-collection-grid",
  });
  const filteredCollection = useMemo(
    () =>
      collection
        .filter((pokemon) => {
          const types =
            pokemon.types
              ?.map((item) => item.type?.name || item.name)
              .filter(Boolean) || [];
          return (
            pokemon.name.toLowerCase().includes(query.trim().toLowerCase()) &&
            (selectedType === "all" || types.includes(selectedType))
          );
        })
        .sort((a, b) => a.id - b.id),
    [collection, query, selectedType],
  );
  const pages = Math.max(1, Math.ceil(filteredCollection.length / pageSize));
  const visibleCollection = filteredCollection.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  useEffect(() => {
    setPage(1);
  }, [query, selectedType]);
  useEffect(() => {
    setPage((current) => Math.min(current, pages));
  }, [pages]);
  useEffect(() => { webStore.getEconomy().then(setEconomy); }, []);
  useEffect(() => { webStore.getDecks().then(setDecks); }, []);

  if (collection.length < 3)
    return (
      <section className="battle-panel empty-team">
        <GameController size={42} weight="fill" />
        <h2>Capture pelo menos 3 Pokémon</h2>
        <p>
          Você precisa de três Pokémon na sua Pokédex para montar uma equipe.
        </p>
        <a href="/pokedex">Capturar Pokémon</a>
      </section>
    );

  return (
    <section className="battle-panel team-selector">
      <div className="battle-collection-heading">
        <div>
          <span className="eyebrow">SEUS POKÉMON</span>
          <h2>
            {filteredCollection.length === collection.length
              ? `${collection.length} na sua Pokédex`
              : `${filteredCollection.length} encontrados`}
          </h2>
          <p>
            {selected.length} / 3 selecionados. A ordem define quem entra
            primeiro.
          </p>
        </div>
        <span className="battle-selection-count" aria-live="polite">
          {selected.length} / 3
        </span>
      </div>
      <div className="team-selection-tabs" role="tablist" aria-label="Forma de montar o time">
        <button type="button" role="tab" aria-controls="team-pokemon-panel" aria-selected={activeTab === "pokemon"} className={activeTab === "pokemon" ? "selected" : ""} onClick={() => setActiveTab("pokemon")} disabled={waiting}>Pokémon</button>
        <button type="button" role="tab" aria-controls="team-decks-panel" aria-selected={activeTab === "decks"} className={activeTab === "decks" ? "selected" : ""} onClick={() => setActiveTab("decks")} disabled={waiting}>Decks</button>
      </div>
      {activeTab === "decks" ? (
        <DecksPanel collection={collection} decks={decks} waiting={waiting} onDecksChange={setDecks} onUseDeck={(team) => { onUseDeck?.(team); setActiveTab("pokemon"); }} />
      ) : <div id="team-pokemon-panel" role="tabpanel">
      <div className="battle-collection-controls">
        <label className="battle-collection-search">
          <MagnifyingGlass size={20} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar na coleção"
            disabled={waiting}
          />
        </label>
        <div className="battle-type-filters" aria-label="Filtrar por tipo">
          <button
            type="button"
            className={selectedType === "all" ? "selected" : ""}
            onClick={() => setSelectedType("all")}
            disabled={waiting}
          >
            Todos
          </button>
          {pokemonData.map((type) => (
            <button
              type="button"
              key={type.type}
              title={type.type}
              className={selectedType === type.type ? "selected" : ""}
              onClick={() => setSelectedType(type.type)}
              disabled={waiting}
            >
              <img src={`/types/${type.type}.svg`} alt={type.type} />
            </button>
          ))}
        </div>
      </div>
      {filteredCollection.length ? (
        <>
          <div className="battle-collection-grid">
            {visibleCollection.map((pokemon) => {
              const index = selected.findIndex(
                (item) => item.id === pokemon.id,
              );
              const isSelected = index >= 0;
              const types =
                pokemon.types
                  ?.map((item) => item.type?.name || item.name)
                  .filter(Boolean) || [];
              const primary = types[0] || getPokemonType(pokemon) || "normal";
              const color =
                pokemonData.find((item) => item.type === primary)?.color ||
                "#64748b";
              return <div key={pokemon.id} className="battle-collection-card-wrap">
                <button
                  type="button"
                  className={`battle-collection-card ${getRarityClassName(pokemon)} ${isSelected ? "selected" : ""}`}
                  style={{ "--type-color": color }}
                  onClick={() => onToggle(pokemon)}
                  aria-label={`${isSelected ? "Remover" : "Selecionar"} ${pokemon.name}${isSelected ? `, posição ${index + 1}` : ""}`}
                  aria-pressed={isSelected}
                  disabled={waiting}
                >
                  <span className="battle-collection-id">
                    #{String(pokemon.id).padStart(3, "0")}
                  </span>
                  <span className="battle-collection-level">
                    Lv. {getPokemonLevel(pokemon)}
                  </span>
                  <PokemonRarity pokemon={pokemon} compact />
                  <PokemonAura pokemon={pokemon} variant="compact" className="battle-card-aura"><img
                    className="battle-collection-art"
                    src={getPokemonArtwork(pokemon)}
                    alt=""
                    loading="lazy"
                  /></PokemonAura>
                  <strong>{pokemon.name}</strong>
                  <span className="battle-collection-types">
                    {types.map((type) => (
                      <TypeBadge key={type} type={type} />
                    ))}
                  </span>
                  {isSelected && (
                    <span className="selection-order">
                      <CheckCircle size={17} weight="fill" /> {index + 1}
                    </span>
                  )}
                </button>
                {pokemon.heldItem ? <button type="button" className="battle-held-item-trigger" onClick={() => setEquipmentPokemon(pokemon)} disabled={waiting} aria-label={`Editar item segurado de ${pokemon.name}`} title="Editar item segurado"><HeldItemBadge item={pokemon.heldItem} compact /></button> : <button type="button" className="battle-equipment-trigger" onClick={() => setEquipmentPokemon(pokemon)} disabled={waiting} aria-label={`Equipar item em ${pokemon.name}`}><Plus size={16} weight="bold" /></button>}
              </div>;
            })}
          </div>
          <PokemonPagination
            page={page}
            pages={pages}
            onChange={setPage}
            disabled={waiting}
            label="Paginação da equipe"
          />
        </>
      ) : (
        <div className="battle-collection-empty">
          <h3>Nenhum Pokémon encontrado</h3>
          <p>Tente outro nome ou tipo.</p>
        </div>
      )}
      <button
        type="button"
        className="ready-button"
        disabled={selected.length !== 3 || waiting || !canReady}
        onClick={onReady}
      >
        {waiting
          ? "PRONTO! Aguardando adversário..."
          : canReady
            ? "Pronto para batalhar"
            : "Conectando a sala..."}
      </button>
      <HeldItemDrawer pokemon={equipmentPokemon || collection[0]} economy={economy} heldItem={equipmentPokemon?.heldItem || null} open={Boolean(equipmentPokemon)} onClose={() => setEquipmentPokemon(null)} onEquipped={(updated) => { setEconomy((current) => current); onEquipmentChanged?.(updated); setEquipmentPokemon((current) => current ? { ...current, heldItem: updated.heldItem } : null); }} />
      </div>}
    </section>
  );
}

function DeckThumbnail({ pokemon }) {
  return pokemon ? <><img src={getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.BATTLE_THUMBNAIL })} alt="" /><small>Lv. {getPokemonLevel(pokemon)}</small></> : <><span className="deck-missing">?</span><small>Indisponível</small></>;
}

function DecksPanel({ collection, decks, waiting, onDecksChange, onUseDeck }) {
  const [editor, setEditor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const cancelDeletionRef = useRef(null);
  const resolve = (deck) => deck.pokemonIds.map((id) => collection.find((pokemon) => String(pokemon.id) === String(id))).filter(Boolean);
  const edit = (deck = null) => setEditor(deck ? { ...deck, pokemonIds: [...deck.pokemonIds] } : { name: "", pokemonIds: [] });
  const toggle = (pokemon) => setEditor((current) => {
    const id = String(pokemon.id);
    if (current.pokemonIds.includes(id)) return { ...current, pokemonIds: current.pokemonIds.filter((item) => item !== id) };
    return current.pokemonIds.length === 3 ? current : { ...current, pokemonIds: [...current.pokemonIds, id] };
  });
  const save = async () => {
    if (!editor?.name.trim() || editor.pokemonIds.length !== 3) return;
    setSaving(true);
    const saved = await webStore.saveDeck(editor);
    setSaving(false);
    if (saved) { onDecksChange((current) => [...current.filter((deck) => deck.id !== saved.id), saved]); setEditor(null); }
  };
  useEffect(() => {
    if (!pendingDeletion) return undefined;
    cancelDeletionRef.current?.focus();
    const closeOnEscape = (event) => { if (event.key === "Escape" && !deleting) setPendingDeletion(null); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingDeletion, deleting]);
  const remove = (deck) => setPendingDeletion(deck);
  const confirmDeletion = async () => {
    if (!pendingDeletion) return;
    setDeleting(true);
    if (await webStore.deleteDeck(pendingDeletion.id)) {
      onDecksChange((current) => current.filter((item) => item.id !== pendingDeletion.id));
      setPendingDeletion(null);
    }
    setDeleting(false);
  };

  if (editor) return <div id="team-decks-panel" className="deck-editor" role="tabpanel">
    <div className="deck-panel-heading"><div><span className="eyebrow">{editor.id ? "EDITAR DECK" : "NOVO DECK"}</span><h3>{editor.pokemonIds.length} / 3 Pokémon</h3></div><button type="button" onClick={() => setEditor(null)} disabled={saving}>Cancelar</button></div>
    <label className="deck-name-field">Nome do deck<input value={editor.name} maxLength={28} placeholder="Ex.: Meus favoritos" onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))} disabled={saving} /></label>
    <p className="deck-editor-help">Escolha três Pokémon da sua coleção. A ordem será mantida na batalha.</p>
    <div className="deck-editor-slots" aria-label="Pokémon escolhidos para o deck">{editor.pokemonIds.map((id, index) => { const pokemon = collection.find((item) => String(item.id) === id); return <button type="button" key={`${id}-${index}`} onClick={() => setEditor((current) => ({ ...current, pokemonIds: current.pokemonIds.filter((item) => item !== id) }))} disabled={saving}><b>{index + 1}</b><DeckThumbnail pokemon={pokemon} /><span>Remover</span></button>; })}</div>
    <div className="deck-picker-grid">
      {collection.map((pokemon) => { const selected = editor.pokemonIds.includes(String(pokemon.id)); return <button key={pokemon.id} type="button" className={`deck-picker-card ${selected ? "selected" : ""}`} onClick={() => toggle(pokemon)} aria-pressed={selected} disabled={saving || (!selected && editor.pokemonIds.length === 3)}><DeckThumbnail pokemon={pokemon} /><strong>{pokemon.name}</strong>{selected && <b>{editor.pokemonIds.indexOf(String(pokemon.id)) + 1}</b>}</button>; })}
    </div>
    <button type="button" className="ready-button" onClick={save} disabled={saving || !editor.name.trim() || editor.pokemonIds.length !== 3}><FloppyDisk size={18} weight="bold" aria-hidden="true" /> {saving ? "Salvando..." : "Salvar deck"}</button>
  </div>;

  return <div id="team-decks-panel" className="decks-panel" role="tabpanel">
    <div className="deck-panel-heading"><div><span className="eyebrow">TIMES FAVORITOS</span><h3>Decks salvos</h3></div><button type="button" className="deck-create-button" onClick={() => edit()} disabled={waiting}><Plus size={17} weight="bold" aria-hidden="true" /> Criar deck</button></div>
    {!decks.length ? <div className="decks-empty"><Star size={34} weight="fill" aria-hidden="true" /><h3>Ainda não há decks</h3><p>Salve seus times favoritos para entrar nas batalhas mais rápido.</p><button type="button" onClick={() => edit()} disabled={waiting}><Plus size={17} weight="bold" aria-hidden="true" /> Criar primeiro deck</button></div> : <div className="deck-list">{decks.map((deck) => {
      const team = resolve(deck); const complete = team.length === 3;
      return <article className={`deck-card ${complete ? "" : "incomplete"}`} key={deck.id}><div className="deck-card-heading"><strong><Star size={15} weight="fill" aria-hidden="true" /> {deck.name}</strong>{!complete && <span>Deck incompleto</span>}</div><div className="deck-pokemon-row">{deck.pokemonIds.map((id, index) => <div className="deck-pokemon" key={`${id}-${index}`}><DeckThumbnail pokemon={collection.find((item) => String(item.id) === String(id))} /></div>)}</div>{!complete && <p>Um Pokémon não está mais disponível. Edite este deck para usá-lo.</p>}<div className="deck-card-actions"><button type="button" onClick={() => onUseDeck(team)} disabled={waiting || !complete}>Usar este deck</button><button type="button" onClick={() => edit(deck)} disabled={waiting} aria-label={`Editar ${deck.name}`}><PencilSimple size={18} weight="bold" aria-hidden="true" /></button><button type="button" onClick={() => remove(deck)} disabled={waiting} aria-label={`Excluir ${deck.name}`}><Trash size={18} weight="bold" aria-hidden="true" /></button></div></article>;
    })}</div>}
    {pendingDeletion && <div className="deck-delete-backdrop" role="presentation"><section className="deck-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="deck-delete-title" aria-describedby="deck-delete-description"><span className="eyebrow">EXCLUIR DECK</span><h3 id="deck-delete-title">Excluir “{pendingDeletion.name}”?</h3><p id="deck-delete-description">Somente o deck será apagado. Seus Pokémon permanecerão na coleção.</p><div><button ref={cancelDeletionRef} type="button" onClick={() => setPendingDeletion(null)} disabled={deleting}>Cancelar</button><button type="button" className="deck-delete-confirm" onClick={confirmDeletion} disabled={deleting}>{deleting ? "Excluindo..." : "Excluir deck"}</button></div></section></div>}
  </div>;
}
