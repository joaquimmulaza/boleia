import React from 'react';
import { formatKwanza } from '../utils/formatKwanza';
import {
  linhaProporcionalPagamento,
  linhaPrazoPagamento,
} from '../utils/pagamentoObrigacaoCopy';
import {
  labelEstadoPagamento,
  chipClassEstadoPagamento,
} from '../utils/paymentStatus';

/**
 * Motorista — estado de pagamento dos passageiros (RPC list_pagamentos_pendentes_motorista_acordo).
 *
 * @param {{ rows: object[], loading?: boolean }} props
 */
function AcordoPagamentosMotoristaPanel({ rows, loading = false }) {
  const list = Array.isArray(rows) ? rows : [];

  if (loading) {
    return (
      <p className="text-sm text-slate-500" data-testid="motorista-pagamentos-loading">
        A carregar pagamentos…
      </p>
    );
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-slate-500" data-testid="motorista-pagamentos-vazio">
        Sem pagamentos pendentes este mês.
      </p>
    );
  }

  return (
    <section className="space-y-3" data-testid="motorista-pagamentos-panel">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
        Pagamentos do mês
      </p>
      <ul className="space-y-3">
        {list.map((row) => {
          const snap = {
            dias: row.dias,
            dias_mes: row.dias_mes,
            mes: row.mes,
            proporcional: row.proporcional,
            pago: row.pago,
            valor: row.valor,
            prazo: row.prazo,
          };
          const linhaProp = linhaProporcionalPagamento(snap);
          const linhaPrazo = linhaPrazoPagamento(row.prazo);
          return (
            <li
              key={row.pagamento_id || row.passenger_id}
              className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 space-y-1"
              data-testid={`motorista-pagamento-${row.passenger_id}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {row.passenger_nome || 'Passageiro'}
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento(row.estado)}`}
                >
                  {labelEstadoPagamento(row.estado, { placement: 'cabecalho' })}
                </span>
              </div>
              {linhaProp ? (
                <p className="text-xs text-slate-500 text-pretty" data-testid="motorista-linha-proporcional">
                  {linhaProp}
                </p>
              ) : (
                <p className="text-xs text-slate-500 tabular-nums">
                  A pagar: {formatKwanza(row.valor)} Kz
                </p>
              )}
              {linhaPrazo ? (
                <p className="text-xs text-amber-800 dark:text-amber-200">{linhaPrazo}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default AcordoPagamentosMotoristaPanel;
