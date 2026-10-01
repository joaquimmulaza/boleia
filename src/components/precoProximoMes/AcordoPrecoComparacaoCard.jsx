import React from 'react';
import { formatKwanza } from '../../utils/formatKwanza.js';
import {
  formatEffectiveFromShortPt,
  formatPrecoDiffPt,
  labelMesActualPt,
} from '../../utils/precoProximoMes.js';

/**
 * Comparação preço actual vs proposto (Figma frame 3).
 * @param {{
 *   precoActual: number,
 *   precoProposto: number,
 *   effectiveFrom: string,
 *   mesActualLabel?: string,
 * }} props
 */
export default function AcordoPrecoComparacaoCard({
  precoActual,
  precoProposto,
  effectiveFrom,
  mesActualLabel = labelMesActualPt(),
}) {
  const diff = formatPrecoDiffPt(precoActual, precoProposto);
  const diffPositive = precoProposto - precoActual > 0;
  const diffNegative = precoProposto - precoActual < 0;

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3"
      data-testid="preco-comparacao-card"
    >
      <p className="text-xs font-semibold text-slate-500">Comparação</p>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">Preço actual ({mesActualLabel})</span>
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatKwanza(precoActual)} Kz
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-500">
          Proposto a partir de {formatEffectiveFromShortPt(effectiveFrom)}
        </span>
        <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
          {formatKwanza(precoProposto)} Kz
        </span>
      </div>
      <div
        className={`rounded-lg px-3 py-2.5 flex items-center justify-between text-[13px] ${
          diffPositive
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
            : diffNegative
              ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
              : 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        <span className="font-medium">Diferença</span>
        <span className="font-semibold tabular-nums">{diff}</span>
      </div>
    </div>
  );
}
