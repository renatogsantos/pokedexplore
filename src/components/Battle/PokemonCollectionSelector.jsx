"use client";

import { CheckCircle, LockKey, MagnifyingGlass } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { getPokemonArtwork, getPokemonType } from "@/lib/battle/pokemon";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";
import { pokemonData } from "@/helpers/PokemonTypes";
import PokemonPagination from "@/components/PokemonPagination";
import useThreeRowPagination from "@/hooks/useThreeRowPagination";
import PokemonAura from "@/components/PokemonAura/PokemonAura";
import { getTypeLabel } from "@/lib/localization/ptBR";
import { getBadgePokemonRestriction } from "@/lib/badges/rules";

function TypeBadge({ type }) {
  return <span className="battle-collection-type"><img src={`/types/${type}.svg`} alt={getTypeLabel(type)} /></span>;
}

/** The one collection visual used for battle, create-deck and edit-deck flows. */
export default function PokemonCollectionSelector({
  collection,
  selected,
  onToggle,
  disabled = false,
  badgeContext = null,
  renderAccessory,
}) {
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [page, setPage] = useState(1);
  const { pageSize } = useThreeRowPagination({ selector: ".battle-collection-grid" });
  const filteredCollection = useMemo(() => collection.filter((pokemon) => {
    const types = pokemon.types?.map((item) => item.type?.name || item.name).filter(Boolean) || [];
    return pokemon.name.toLowerCase().includes(query.trim().toLowerCase()) && (selectedType === "all" || types.includes(selectedType));
  }).sort((a, b) => a.id - b.id), [collection, query, selectedType]);
  const pages = Math.max(1, Math.ceil(filteredCollection.length / pageSize));
  const visibleCollection = filteredCollection.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => setPage(1), [query, selectedType]);
  useEffect(() => setPage((current) => Math.min(current, pages)), [pages]);

  return <>
    <div className="battle-collection-controls">
      <label className="battle-collection-search">
        <MagnifyingGlass size={20} aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar na coleção" disabled={disabled} />
      </label>
      <div className="battle-type-filters" aria-label="Filtrar por tipo">
        <button type="button" className={selectedType === "all" ? "selected" : ""} onClick={() => setSelectedType("all")} disabled={disabled}>Todos</button>
        {pokemonData.map((type) => <button type="button" key={type.type} title={type.type} className={selectedType === type.type ? "selected" : ""} onClick={() => setSelectedType(type.type)} disabled={disabled}><img src={`/types/${type.type}.svg`} alt={type.type} /></button>)}
      </div>
    </div>
    {filteredCollection.length ? <>
      <div className="battle-collection-grid">
        {visibleCollection.map((pokemon) => {
          const index = selected.findIndex((item) => String(item.id) === String(pokemon.id));
          const isSelected = index >= 0;
          const types = pokemon.types?.map((item) => item.type?.name || item.name).filter(Boolean) || [];
          const primary = types[0] || getPokemonType(pokemon) || "normal";
          const color = pokemonData.find((item) => item.type === primary)?.color || "#64748b";
          const restriction = badgeContext ? getBadgePokemonRestriction(pokemon) : null;
          const restrictionLabel = restriction === "legendary" ? "Lendário" : restriction === "mythical" ? "Mítico" : "";
          const selectionFull = selected.length === 3 && !isSelected;
          return <div key={pokemon.id} className="battle-collection-card-wrap">
            <button type="button" className={`battle-collection-card ${getRarityClassName(pokemon)} ${isSelected ? "selected" : ""} ${restriction ? "badge-ineligible" : ""}`} style={{ "--type-color": color }} onClick={() => !restriction && onToggle(pokemon)} aria-disabled={Boolean(restriction || selectionFull)} aria-label={restriction ? `${pokemon.name}, ${restrictionLabel}, não permitido em Desafios de Insígnia` : `${isSelected ? "Remover" : "Selecionar"} ${pokemon.name}${isSelected ? `, posição ${index + 1}` : ""}`} aria-pressed={isSelected} disabled={disabled || Boolean(restriction || selectionFull)}>
              <span className="battle-collection-id">#{String(pokemon.id).padStart(3, "0")}</span>
              <span className="battle-collection-level">Lv. {getPokemonLevel(pokemon)}</span>
              <PokemonRarity pokemon={pokemon} compact />
              <PokemonAura pokemon={pokemon} variant="compact" className="battle-card-aura"><img className="battle-collection-art" src={getPokemonArtwork(pokemon)} alt="" loading="lazy" /></PokemonAura>
              <strong>{pokemon.name}</strong>
              <span className="battle-collection-types">{types.map((type) => <TypeBadge key={type} type={type} />)}</span>
              {isSelected && <span className="selection-order"><CheckCircle size={17} weight="fill" /> {index + 1}</span>}
              {restriction && <span className="badge-ineligible-reason"><LockKey size={15} weight="fill" aria-hidden="true" /> Não permitido em Desafios de Insígnia</span>}
            </button>
            {renderAccessory?.(pokemon)}
          </div>;
        })}
      </div>
      <PokemonPagination page={page} pages={pages} onChange={setPage} disabled={disabled} label="Paginação da equipe" />
    </> : <div className="battle-collection-empty"><h3>Nenhum Pokémon encontrado</h3><p>Tente outro nome ou tipo.</p></div>}
  </>;
}
