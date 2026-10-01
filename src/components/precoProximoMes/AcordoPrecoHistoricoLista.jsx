import React from 'react';
import { formatKwanza } from '../../utils/formatKwanza.js';
import {
  chipClassHistoricoAdenda,
  describeHistoricoAdenda,
  footerHistoricoAdenda,
  labelChipHistoricoAdenda,
} from '../../utils/adendaNegociacao.js';
import { labelMesActualPt } from '../../utils/precoProximoMes.js';

/**
 * Lista completa de propostas de preço (Figma histórico).
 * @param {{ historico: object[], mesActualLabel?: string }} props
 */
export default function AcordoPrecoHistoricoLista({
  historico,
  mesActualLabel = labelMesActualPt(),
}) {
  if (!historico?.length) {
    return (
      <p className="text-sm text-slate-500" data-testid="preco-historico-vazio">
        Ainda não há propostas de preço neste acordo.
      </p>
    );
  }

  return (
    <ul className="space-y-3" data-testid="preco-historico-lista">
      {historico.map((row) => (
        <li
          key={row.id}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {row.valor_mensal_por_passageiro_kz != null
                ? `${formatKwanza(row.valor_mensal_por_passageiro_kz)} Kz`
                : 'Proposta de preço'}
            </p>
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${chipClassHistoricoAdenda(row)}`}
            >
              {labelChipHistoricoAdenda(row)}
            </span>
          </div>
          <p className="text-xs text-slate-500 text-pretty">
            {describeHistoricoAdenda(row, { mesActualLabel })}
          </p>
          <p className="text-[11px] text-slate-400">{footerHistoricoAdenda(row)}</p>
        </li>
      ))}
    </ul>
  );
}
