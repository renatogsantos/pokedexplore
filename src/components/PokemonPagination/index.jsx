"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";

export default function PokemonPagination({ page, pages, onChange, disabled = false, label = "Paginação de Pokémon" }) {
  if (pages <= 1) return null;

  return (
    <nav className="pokemon-pagination" aria-label={label}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={disabled || page <= 1}>
        <CaretLeft size={18} weight="bold" /> Anterior
      </button>
      <span aria-live="polite">Página {page} de {pages}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={disabled || page >= pages}>
        Próxima <CaretRight size={18} weight="bold" />
      </button>
    </nav>
  );
}

