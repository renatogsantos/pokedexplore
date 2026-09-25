"use client";

import { FloppyDisk, GameController, PencilSimple, Plus, Star, Timer, Trash, Warning } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import ItemSprite from "@/components/ItemSprite/ItemSprite";
import HeldItemDrawer from "@/components/HeldItemDrawer/HeldItemDrawer";
import ConfirmationDialog from "@/components/ConfirmationDialog";
import PokemonCollectionSelector from "@/components/Battle/PokemonCollectionSelector";
import { webStore } from "@/helpers/webStore";
import { getPokemonSprite, SPRITE_CONTEXT } from "@/lib/pokemon/sprites";
import { getTypeLabel } from "@/lib/localization/ptBR";
import { getBadgeTeamErrorMessage, validateBadgeTeam } from "@/lib/badges/rules";
import { getItemDefinition } from "@/lib/items/catalog";
import { getSelectionTimerState } from "@/lib/battle/selectionTimer";

function HeldItemBadge({ item, compact = false }) {
  if (!item) return compact ? null : <span className="battle-held-item empty">SEM ITEM</span>;
  return <span className={`battle-held-item ${compact ? "compact" : ""}`}><ItemSprite item={item} alt="" className="battle-held-item-sprite" />{!compact && `${getItemDefinition(item)?.name || "Item"} · EQUIPADO`}</span>;
}

export default function TeamSelector({ collection, selected, onToggle, onReady, waiting, preparing = false, canReady = true, onEquipmentChanged, onUseDeck, badgeContext = null, cpuDifficulty = null, selectionTiming = null, opponentReady = false }) {
  const [economy, setEconomy] = useState({ inventory: {} });
  const [equipmentPokemon, setEquipmentPokemon] = useState(null);
  const [activeTab, setActiveTab] = useState("pokemon");
  const [decks, setDecks] = useState([]);
  const badgeValidation = useMemo(() => badgeContext ? validateBadgeTeam(selected, badgeContext.type) : null, [badgeContext, selected]);
  useEffect(() => { webStore.getEconomy().then(setEconomy); }, []);
  useEffect(() => { webStore.getDecks().then(setDecks); }, []);
  if (collection.length < 3) return <section className="battle-panel empty-team"><GameController size={42} weight="fill" /><h2>Capture pelo menos 3 Pokémon</h2><p>Você precisa de três Pokémon na sua Pokédex para montar uma equipe.</p><a href="/pokedex">Capturar Pokémon</a></section>;
  const selectedEquipment = selected.map((entry) => collection.find((pokemon) => String(pokemon.id) === String(entry.id)) || entry);
  return <section className="battle-panel team-selector">
    {cpuDifficulty && <aside className={`cpu-battle-brief cpu-battle-brief--${cpuDifficulty.id}`} aria-label={`Dificuldade ${cpuDifficulty.label}`}>
      <span>DIFICULDADE · {cpuDifficulty.label.toUpperCase()}</span>
      <strong>{cpuDifficulty.summary}</strong>
      <small>🪙 {cpuDifficulty.baseCoins} base · 🎁 {Math.round(cpuDifficulty.itemDropChance * 100)}%{cpuDifficulty.id === "hard" ? " · pode conter Lendário" : ""}</small>
    </aside>}
    <div className="battle-collection-heading"><div><span className="eyebrow">SEUS POKÉMON</span><h2>{collection.length} na sua Pokédex</h2><p>{selected.length} / 3 selecionados. A ordem define quem entra primeiro.</p></div><div className="battle-selection-meta"><SelectionTimer timing={selectionTiming} waiting={waiting} opponentReady={opponentReady} /><span className="battle-selection-count" aria-live="polite">{selected.length} / 3</span></div></div>
    {badgeContext && <BadgeRequirements badgeContext={badgeContext} selected={selected} validation={badgeValidation} />}
    {activeTab === "pokemon" && selectedEquipment.length > 0 && <section className="selected-equipment-list" aria-label="Itens equipados na equipe selecionada">{selectedEquipment.map((pokemon) => <article key={pokemon.id}><div><strong>{pokemon.name}</strong><small>Lv. {getPokemonLevel(pokemon)} · {(pokemon.types?.map((item) => item.type?.name || item.name).filter(Boolean) || []).map(getTypeLabel).join(" / ")}</small></div><span><small>ITEM EQUIPADO</small><HeldItemBadge item={pokemon.heldItem} /></span><button type="button" onClick={() => setEquipmentPokemon(pokemon)} disabled={waiting}>{pokemon.heldItem ? "TROCAR ITEM" : "EQUIPAR ITEM"}</button></article>)}</section>}
    <div className="team-selection-tabs" role="tablist" aria-label="Forma de montar o time"><button type="button" role="tab" aria-controls="team-pokemon-panel" aria-selected={activeTab === "pokemon"} className={activeTab === "pokemon" ? "selected" : ""} onClick={() => setActiveTab("pokemon")} disabled={waiting}>Pokémon</button><button type="button" role="tab" aria-controls="team-decks-panel" aria-selected={activeTab === "decks"} className={activeTab === "decks" ? "selected" : ""} onClick={() => setActiveTab("decks")} disabled={waiting}>Decks</button></div>
    {activeTab === "decks" ? <DecksPanel collection={collection} decks={decks} waiting={waiting} badgeContext={badgeContext} onDecksChange={setDecks} onUseDeck={(team) => { onUseDeck?.(team); setActiveTab("pokemon"); }} /> : <div id="team-pokemon-panel" role="tabpanel"><PokemonCollectionSelector collection={collection} selected={selected} onToggle={onToggle} disabled={waiting} badgeContext={badgeContext} renderAccessory={(pokemon) => pokemon.heldItem ? <button type="button" className="battle-held-item-trigger" onClick={() => setEquipmentPokemon(pokemon)} disabled={waiting} aria-label={`Editar item segurado de ${pokemon.name}`}><HeldItemBadge item={pokemon.heldItem} compact /></button> : <button type="button" className="battle-equipment-trigger" onClick={() => setEquipmentPokemon(pokemon)} disabled={waiting} aria-label={`Equipar item em ${pokemon.name}`}><Plus size={16} weight="bold" /></button>} /><button type="button" className="ready-button" disabled={selected.length !== 3 || waiting || !canReady || (badgeContext && !badgeValidation?.valid)} onClick={onReady}>{preparing ? "PREPARANDO EQUIPE..." : waiting ? "PRONTO! Aguardando adversário..." : canReady ? "Pronto para batalhar" : "Conectando a sala..."}</button><HeldItemDrawer pokemon={equipmentPokemon || collection[0]} economy={economy} collection={collection} heldItem={equipmentPokemon?.heldItem || null} open={Boolean(equipmentPokemon)} onClose={() => setEquipmentPokemon(null)} onEquipped={(updated, _message, result) => { if (result?.economy) setEconomy(result.economy); onEquipmentChanged?.(updated); setEquipmentPokemon(updated); }} /></div>}
  </section>;
}

function SelectionTimer({ timing, waiting, opponentReady }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!timing?.urgencyDeadline) return undefined;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [timing?.id, timing?.urgencyDeadline]);
  const state = getSelectionTimerState(timing, now);
  if (state.phase === "idle" || state.phase === "expired") return null;
  const urgency = state.phase === "urgency";
  const label = waiting ? (opponentReady ? "EQUIPES PRONTAS" : "AGUARDANDO ADVERSÁRIO") : urgency ? "FINALIZE SEU TIME" : "ESCOLHA SEU TIME";
  const minutes = String(Math.floor(state.remainingSeconds / 60)).padStart(2, "0");
  const seconds = String(state.remainingSeconds % 60).padStart(2, "0");
  return <aside className={`selection-timer ${urgency ? "is-urgent" : ""} ${waiting ? "is-ready" : ""}`} aria-label={`${label}: ${minutes} minutos e ${seconds} segundos`}>
    {urgency ? <Warning size={17} weight="fill" aria-hidden="true" /> : <Timer size={17} weight="bold" aria-hidden="true" />}
    <span>{label}</span><strong>{minutes}:{seconds}</strong>
    {urgency && !waiting && <small role="status">Faltam 15 segundos para finalizar seu time.</small>}
  </aside>;
}

function BadgeRequirements({ badgeContext, selected, validation }) {
  return <section className="badge-team-requirements" aria-label="Requisitos do Desafio da Insígnia"><div><img src={badgeContext.fallbackImage} alt="" aria-hidden="true" /><span><small>DESAFIO DA INSÍGNIA</small><strong>{badgeContext.name}</strong></span></div><ul><li className={selected.length === 3 ? "valid" : ""}>Equipe {selected.length}/3</li><li className={validation?.hasRequiredType ? "valid" : ""}>1 Pokémon {badgeContext.localizedTypeName}</li><li className={!validation?.hasLegendary && !validation?.hasMythical ? "valid" : ""}>Sem Lendários ou Míticos</li></ul>{selected.length === 3 && !validation?.valid && <p role="alert">{getBadgeTeamErrorMessage(validation, badgeContext.localizedTypeName)}</p>}</section>;
}

function DeckThumbnail({ pokemon }) { return pokemon ? <><img src={getPokemonSprite({ pokemon, context: SPRITE_CONTEXT.BATTLE_THUMBNAIL })} alt="" /><small>Lv. {getPokemonLevel(pokemon)}</small></> : <><span className="deck-missing">?</span><small>Indisponível</small></>; }

function DecksPanel({ collection, decks, waiting, badgeContext, onDecksChange, onUseDeck }) {
  const [editor, setEditor] = useState(null); const [nameSheet, setNameSheet] = useState(false); const [renameDeck, setRenameDeck] = useState(null); const [saving, setSaving] = useState(false); const [pendingDeletion, setPendingDeletion] = useState(null); const [deleting, setDeleting] = useState(false); const [feedback, setFeedback] = useState("");
  const resolve = (deck) => deck.pokemonIds.map((id) => collection.find((pokemon) => String(pokemon.id) === String(id))).filter(Boolean);
  const startEditor = (deck = null) => setEditor(deck ? { ...deck, pokemonIds: [...deck.pokemonIds] } : { name: "", pokemonIds: [] });
  const toggleDraft = (pokemon) => setEditor((current) => { const id = String(pokemon.id); return current.pokemonIds.includes(id) ? { ...current, pokemonIds: current.pokemonIds.filter((item) => item !== id) } : current.pokemonIds.length === 3 ? current : { ...current, pokemonIds: [...current.pokemonIds, id] }; });
  const cancelEditor = () => { setNameSheet(false); setEditor(null); };
  const save = async (deck = editor) => { if (!deck?.name.trim() || deck.pokemonIds.length !== 3) return; setSaving(true); const saved = await webStore.saveDeck(deck); setSaving(false); if (saved) { onDecksChange((current) => [...current.filter((item) => item.id !== saved.id), saved]); cancelEditor(); setFeedback(deck.id ? "ALTERAÇÕES SALVAS!" : "DECK CRIADO!"); } };
  const confirmDeletion = async () => { if (!pendingDeletion) return; setDeleting(true); if (await webStore.deleteDeck(pendingDeletion.id)) { onDecksChange((current) => current.filter((item) => item.id !== pendingDeletion.id)); setPendingDeletion(null); } setDeleting(false); };
  if (editor) { const isComplete = editor.pokemonIds.length === 3; return <div id="team-decks-panel" className="deck-editor deck-selector-flow" role="tabpanel"><div className="deck-panel-heading"><div><span className="eyebrow">{editor.id ? "EDITAR DECK" : "NOVO DECK"}</span><h3>{editor.pokemonIds.length} / 3 Pokémon</h3><p>Escolha seu time. A ordem selecionada será mantida.</p></div><button type="button" onClick={cancelEditor} disabled={saving}>Cancelar</button></div><PokemonCollectionSelector collection={collection} selected={editor.pokemonIds.map((id) => ({ id }))} onToggle={toggleDraft} disabled={saving} /><div className={`deck-draft-cta ${isComplete ? "complete" : ""}`} aria-live="polite"><span>{isComplete ? "✓ TIME COMPLETO" : `ESCOLHA MAIS ${3 - editor.pokemonIds.length}`}</span><button type="button" className="ready-button" disabled={!isComplete || saving} onClick={() => editor.id ? save() : setNameSheet(true)}>{editor.id ? <><FloppyDisk size={18} weight="bold" /> Salvar alterações</> : "Criar deck"}</button></div>{nameSheet && <DeckNameSheet editor={editor} collection={collection} saving={saving} onCancel={() => setNameSheet(false)} onChange={(name) => setEditor((current) => ({ ...current, name }))} onSave={save} />}</div>; }
  return <div id="team-decks-panel" className="decks-panel" role="tabpanel"><div className="deck-panel-heading"><div><span className="eyebrow">TIMES FAVORITOS</span><h3>Decks salvos</h3></div><button type="button" className="deck-create-button" onClick={() => startEditor()} disabled={waiting}><Plus size={17} weight="bold" /> Criar deck</button></div>{feedback && <p className="deck-feedback" role="status">✓ {feedback}</p>}{!decks.length ? <div className="decks-empty"><Star size={34} weight="fill" aria-hidden="true" /><h3>Ainda não há decks</h3><p>Salve seus times favoritos para entrar nas batalhas mais rápido.</p><button type="button" onClick={() => startEditor()} disabled={waiting}><Plus size={17} weight="bold" /> Criar primeiro deck</button></div> : <div className="deck-list">{decks.map((deck) => { const team = resolve(deck); const complete = team.length === 3; const validation = badgeContext && complete ? validateBadgeTeam(team, badgeContext.type) : null; const compatible = complete && (!badgeContext || validation.valid); return <article className={`deck-card ${complete ? "" : "incomplete"} ${!compatible && badgeContext ? "badge-incompatible" : ""}`} key={deck.id}><div className="deck-card-heading"><strong><Star size={15} weight="fill" /> {deck.name}</strong>{!complete ? <span>Deck incompleto</span> : !compatible ? <span>Deck incompatível</span> : null}</div><div className="deck-pokemon-row">{deck.pokemonIds.map((id, index) => <div className="deck-pokemon" key={`${id}-${index}`}><DeckThumbnail pokemon={collection.find((item) => String(item.id) === String(id))} /></div>)}</div>{!complete ? <p>Um Pokémon não está mais disponível. Edite este deck para usá-lo.</p> : !compatible ? <p>{getBadgeTeamErrorMessage(validation, badgeContext.localizedTypeName)}</p> : null}<div className="deck-card-actions"><button type="button" onClick={() => onUseDeck(team)} disabled={waiting || !compatible}>Usar este deck</button><button type="button" onClick={() => startEditor(deck)} disabled={waiting} aria-label={`Editar ${deck.name}`}><PencilSimple size={18} weight="bold" /></button><button type="button" onClick={() => setRenameDeck(deck)} disabled={waiting} aria-label={`Renomear ${deck.name}`}>Aa</button><button type="button" onClick={() => setPendingDeletion(deck)} disabled={waiting} aria-label={`Excluir ${deck.name}`}><Trash size={18} weight="bold" /></button></div></article>; })}</div>}<ConfirmationDialog open={Boolean(pendingDeletion)} id="deck-delete-dialog" eyebrow="EXCLUIR DECK" title={pendingDeletion ? `Excluir “${pendingDeletion.name}”?` : "Excluir deck?"} description="Somente o deck será apagado. Seus Pokémon permanecerão na coleção." cancelLabel="Cancelar" confirmLabel="Excluir deck" busyLabel="Excluindo..." busy={deleting} onCancel={() => setPendingDeletion(null)} onConfirm={confirmDeletion} />{renameDeck && <DeckNameSheet editor={renameDeck} collection={collection} saving={saving} title="RENOMEAR DECK" confirmLabel="Salvar nome" onCancel={() => setRenameDeck(null)} onChange={(name) => setRenameDeck((current) => ({ ...current, name }))} onSave={async () => { await save(renameDeck); setRenameDeck(null); }} />}</div>;
}

function DeckNameSheet({ editor, collection, saving, title = "CRIAR DECK", confirmLabel = "Salvar deck", onCancel, onChange, onSave }) { return <div className="deck-name-backdrop" role="presentation"><section className="deck-name-sheet" role="dialog" aria-modal="true" aria-labelledby="deck-name-title"><span className="eyebrow">{title}</span><h3 id="deck-name-title">Dê um nome ao seu time</h3><div className="deck-name-preview">{editor.pokemonIds.map((id) => <span key={id}><DeckThumbnail pokemon={collection.find((pokemon) => String(pokemon.id) === String(id))} /></span>)}</div><label className="deck-name-field">Nome do deck<input autoFocus value={editor.name} maxLength={28} placeholder="Ex.: Meus favoritos" onChange={(event) => onChange(event.target.value)} disabled={saving} /></label><div className="deck-name-actions"><button type="button" onClick={onCancel} disabled={saving}>Cancelar</button><button type="button" onClick={() => onSave()} disabled={saving || !editor.name.trim()}>{saving ? "Salvando..." : confirmLabel}</button></div></section></div>; }
