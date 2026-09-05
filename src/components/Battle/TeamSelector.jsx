"use client";

import { CheckCircle, GameController } from "@phosphor-icons/react";
import { getPokemonArtwork, getPokemonType } from "@/lib/battle/pokemon";
import { getPokemonLevel } from "@/lib/pokemon/progression";
import PokemonRarity, { getRarityClassName } from "@/components/PokemonRarity";

export default function TeamSelector({ collection, selected, onToggle, onReady, waiting, canReady = true }) {
  if (collection.length < 3) return <section className="battle-panel empty-team"><GameController size={42} weight="fill" /><h2>Capture pelo menos 3 Pokemon</h2><p>Voce precisa de tres Pokemon na sua Pokedex para montar uma equipe.</p><a href="/pokedex">Capturar Pokemon</a></section>;
  return <section className="battle-panel team-selector"><div className="setup-copy"><span className="eyebrow">MONTE SUA EQUIPE</span><h2>Escolha 3 Pokemon</h2><p>{selected.length} / 3 selecionados. A ordem define quem entra primeiro.</p></div><div className="team-grid">{collection.map((pokemon) => { const index = selected.findIndex((item) => item.id === pokemon.id); const isSelected = index >= 0; return <button type="button" key={pokemon.id} className={`team-card ${isSelected ? "selected" : ""} ${getRarityClassName(pokemon)}`} onClick={() => onToggle(pokemon)} aria-pressed={isSelected} disabled={waiting}><PokemonRarity pokemon={pokemon} compact /><img src={getPokemonArtwork(pokemon)} alt={pokemon.name} /><span className="team-card-name">{pokemon.name}</span><span className="team-card-level">Lv. {getPokemonLevel(pokemon)}</span><span className="team-card-type">{getPokemonType(pokemon)}</span>{isSelected && <span className="selection-order"><CheckCircle size={17} weight="fill" /> {index + 1}</span>}</button>; })}</div><button type="button" className="ready-button" disabled={selected.length !== 3 || waiting || !canReady} onClick={onReady}>{waiting ? "PRONTO! Aguardando adversario..." : canReady ? "Pronto para batalhar" : "Conectando a sala..."}</button></section>;
}
