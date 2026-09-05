"use client";

import { CheckCircle, GameController, MagnifyingGlass } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { getPokemonArtwork, getPokemonType } from "@/lib/battle/pokemon";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { pokemonData } from "@/helpers/PokemonTypes";

function TypeBadge({ type }) {
  return <span className="battle-collection-type"><img src={`/types/${type}.svg`} alt="" />{type}</span>;
}

export default function TeamSelector({ collection, selected, onToggle, onReady, waiting, canReady = true }) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const filteredCollection = useMemo(() => collection.filter((pokemon) => {
    const types = pokemon.types?.map((item) => item.type?.name || item.name).filter(Boolean) || [];
    return pokemon.name.toLowerCase().includes(query.trim().toLowerCase()) && (selectedType === "all" || types.includes(selectedType));
  }).sort((a, b) => a.id - b.id), [collection, query, selectedType]);

  if (collection.length < 3) return <section className="battle-panel empty-team"><GameController size={42} weight="fill" /><h2>Capture pelo menos 3 Pokémon</h2><p>Você precisa de três Pokémon na sua Pokédex para montar uma equipe.</p><a href="/pokedex">Capturar Pokémon</a></section>;

  return <section className="battle-panel team-selector">
    <div className="battle-collection-heading">
      <div><span className="eyebrow">SEUS POKÉMON</span><h2>{filteredCollection.length === collection.length ? `${collection.length} na sua Pokédex` : `${filteredCollection.length} encontrados`}</h2><p>{selected.length} / 3 selecionados. A ordem define quem entra primeiro.</p></div>
      <span className="battle-selection-count" aria-live="polite">{selected.length} / 3</span>
    </div>
    <div className="battle-collection-controls">
      <label className="battle-collection-search"><MagnifyingGlass size={20} aria-hidden="true" /><span className="sr-only">Buscar Pokémon capturado</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na coleção" disabled={waiting} /></label>
      <div className="battle-type-filters" aria-label="Filtrar por tipo">
        <button type="button" className={selectedType === "all" ? "selected" : ""} onClick={() => setSelectedType("all")} disabled={waiting}>Todos</button>
        {pokemonData.map((type) => <button type="button" key={type.type} title={type.type} className={selectedType === type.type ? "selected" : ""} onClick={() => setSelectedType(type.type)} disabled={waiting}><img src={`/types/${type.type}.svg`} alt={type.type} /></button>)}
      </div>
    </div>
    {filteredCollection.length ? <div className="battle-collection-grid">
      {filteredCollection.map((pokemon) => {
        const index = selected.findIndex((item) => item.id === pokemon.id);
        const isSelected = index >= 0;
        const types = pokemon.types?.map((item) => item.type?.name || item.name).filter(Boolean) || [];
        const primary = types[0] || getPokemonType(pokemon) || "normal";
        const color = pokemonData.find((item) => item.type === primary)?.color || "#64748b";
        return <button type="button" key={pokemon.id} className={`battle-collection-card ${getRarityClassName(pokemon)} ${isSelected ? "selected" : ""}`} style={{ "--type-color": color }} onClick={() => onToggle(pokemon)} aria-label={`${isSelected ? "Remover" : "Selecionar"} ${pokemon.name}${isSelected ? `, posição ${index + 1}` : ""}`} aria-pressed={isSelected} disabled={waiting}>
          <span className="battle-collection-id">#{String(pokemon.id).padStart(3, "0")}</span>
          <span className="battle-collection-level">Lv. {getPokemonLevel(pokemon)}</span>
          <PokemonRarity pokemon={pokemon} compact />
          <img className="battle-collection-art" src={getPokemonArtwork(pokemon)} alt="" loading="lazy" />
          <strong>{pokemon.name}</strong>
          <span className="battle-collection-types">{types.map((type) => <TypeBadge key={type} type={type} />)}</span>
          {isSelected && <span className="selection-order"><CheckCircle size={17} weight="fill" /> {index + 1}</span>}
        </button>;
      })}
    </div> : <div className="battle-collection-empty"><h3>Nenhum Pokémon encontrado</h3><p>Tente outro nome ou tipo.</p></div>}
    <button type="button" className="ready-button" disabled={selected.length !== 3 || waiting || !canReady} onClick={onReady}>{waiting ? "PRONTO! Aguardando adversário..." : canReady ? "Pronto para batalhar" : "Conectando a sala..."}</button>
  </section>;
}
