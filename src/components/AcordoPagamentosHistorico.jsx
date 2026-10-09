import React from 'react';
import {
  tituloHistoricoPagamento,
  valorHistoricoPagamento,
} from '../utils/pagamentoObrigacaoCopy';
import {
  labelEstadoPagamento,
  chipClassEstadoPagamento,
} from '../utils/paymentStatus';

/**
 * Lista compacta de pagamentos passados do acordo (v1.5).
 *
 * @param {{
 *   pagamentos: Array<{ id: string, mes_referencia?: string, estado?: string, valor_kz?: number, valor_quota_original_kz?: number }>,
 *   mesActual: string,
 * }} props
 */
function AcordoPagamentosHistorico({ pagamentos, mesActual }) {
  const mes = String(mesActual || '').slice(0, 10);
  const rows = (Array.isArray(pagamentos) ? pagamentos : [])
    .filter((p) => String(p.mes_referencia || '').slice(0, 10) !== mes)
    .sort((a, b) => String(b.mes_referencia).localeCompare(String(a.mes_referencia)));

  if (rows.length === 0) return null;

  return (
    <section className="space-y-2" data-testid="pagamentos-historico">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Histórico</p>
      <ul className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {rows.map((p) => {
          const { texto, anulado } = valorHistoricoPagamento(p, null);
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm"
              data-testid={`pagamento-historico-${p.id}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-slate-800 dark:text-slate-100 truncate">
                  {tituloHistoricoPagamento(p.mes_referencia)}
                </p>
                <span
                  className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${chipClassEstadoPagamento(p.estado)}`}
                >
                  {labelEstadoPagamento(p.estado, { placement: 'cabecalho' })}
                </span>
              </div>
              <span
                className={`tabular-nums shrink-0 font-semibold ${
                  anulado ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'
                }`}
              >
                {texto}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default AcordoPagamentosHistorico;
