import React from 'react';
import { formatKwanza } from '../../utils/formatKwanza.js';
import { formatEffectiveFromLongPt } from '../../utils/precoProximoMes.js';

/**
 * Pré-visualização do preço futuro (Figma «Pré-visualização»).
 * @param {{
 *   effectiveFrom: string,
 *   valorKz: number | null,
 *   mesActualLabel: string,
 *   precoActual: number,
 *   invalid?: boolean,
 *   invalidMessage?: string,
 * }} props
 */
export default function AcordoPrecoPreviewCard({
  effectiveFrom,
  valorKz,
  mesActualLabel,
  precoActual,
  invalid = false,
  invalidMessage = 'Indica um valor maior que 0 Kz',
}) {
  const titulo = invalid || valorKz == null || valorKz < 1
    ? invalidMessage
    : `${formatEffectiveFromLongPt(effectiveFrom)}: ${formatKwanza(valorKz)} Kz`;

  return (
    <div
      className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-3.5 space-y-2"
      data-testid="preco-preview-card"
    >
      <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-200">
        Pré-visualização
      </p>
      <p
        className={`text-[15px] font-semibold ${
          invalid ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'
        }`}
      >
        {titulo}
      </p>
      <p className="text-[13px] text-slate-500 dark:text-slate-400">
        {mesActualLabel} mantém {formatKwanza(precoActual)} Kz
      </p>
    </div>
  );
}
