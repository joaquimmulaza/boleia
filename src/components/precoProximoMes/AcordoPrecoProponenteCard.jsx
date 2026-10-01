import React from 'react';
import { iniciaisNome } from '../../hooks/useAcordoRatingContext.js';

/**
 * Cartão do proponente (Figma «João M. · Motorista»).
 * @param {{ nome: string, papel: string, subtitulo?: string }} props
 */
export default function AcordoPrecoProponenteCard({ nome, papel, subtitulo = 'Propôs um novo preço' }) {
  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex items-center gap-3"
      data-testid="preco-proponente-card"
    >
      <div
        className="size-10 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-sm font-semibold text-emerald-800 dark:text-emerald-100"
        aria-hidden="true"
      >
        {iniciaisNome(nome)}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
          {nome} · {papel}
        </p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">{subtitulo}</p>
      </div>
    </div>
  );
}
