import React from 'react';
import {
  normalizeObrigacaoSnapshot,
  linhaPrazoPagamento,
  tituloSecaoPagamentosMotorista,
  valorEmDividaParaExibir,
} from '../utils/pagamentoObrigacaoCopy';
import {
  labelEstadoPagamento,
  chipClassEstadoPagamento,
  PAYMENT_STATES,
} from '../utils/paymentStatus';
import {
  linhaMotoristaComprovativoValidacao,
  linhaMotoristaDiferencaExcesso,
  linhaMotoristaValorEmDivida,
  linhaSecundariaMotoristaDias,
} from '../utils/resolveAcordoPagamentoUi';

/**
 * Motorista — estado de pagamento dos passageiros (RPC list_pagamentos_pendentes_motorista_acordo).
 *
 * @param {{
 *   rows: object[],
 *   loading?: boolean,
 *   acordoTerminado?: boolean,
 *   multiplePaymentSections?: boolean,
 * }} props
 */
function AcordoPagamentosMotoristaPanel({
  rows,
  loading = false,
  acordoTerminado = false,
  multiplePaymentSections = false,
}) {
  const list = Array.isArray(rows) ? rows : [];
  const titulo = tituloSecaoPagamentosMotorista({ acordoTerminado, multipleSections: multiplePaymentSections });

  if (loading) {
    return (
      <p className="text-sm text-slate-500" data-testid="motorista-pagamentos-loading">
        A carregar pagamentos…
      </p>
    );
  }

  if (list.length === 0) {
    return (
      <section className="space-y-2" data-testid="motorista-pagamentos-vazio-wrap">
        <p className="text-sm font-bold text-slate-900 dark:text-white" data-testid="motorista-pagamentos-titulo">
          {titulo}
        </p>
        <p className="text-sm text-slate-500" data-testid="motorista-pagamentos-vazio">
          Sem pagamentos pendentes este mês.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="motorista-pagamentos-panel">
      <p className="text-sm font-bold text-slate-900 dark:text-white" data-testid="motorista-pagamentos-titulo">
        {titulo}
      </p>
      <ul className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
        {list.flatMap((row) => {
          const nome = row.passenger_nome || 'Passageiro';
          const snap = normalizeObrigacaoSnapshot({
            dias: row.dias,
            dias_mes: row.dias_mes,
            mes: row.mes,
            quota: row.quota,
            proporcional: row.proporcional,
            pago: row.pago,
            valor: row.valor,
            valor_em_divida: row.valor_em_divida ?? row.valor,
            prazo: row.prazo,
          });
          const estado = String(row.estado || '').toLowerCase();
          const requerAdmin = Boolean(row.requer_resolucao_admin);
          const excesso = Number(row.excesso_kz);
          const valorComprovativo = row.valor_comprovativo != null
            ? Number(row.valor_comprovativo)
            : null;
          const linhaPrazo = linhaPrazoPagamento(row.prazo);
          const items = [];

          if (requerAdmin && Number.isFinite(excesso) && excesso > 0) {
            const textoExcesso = linhaMotoristaDiferencaExcesso(nome, excesso);
            items.push(
              <li
                key={`${row.pagamento_id}-excesso`}
                className="p-4 flex items-start justify-between gap-3"
                data-testid={`motorista-pagamento-excesso-${row.passenger_id}`}
              >
                <p className="text-sm text-slate-800 dark:text-slate-100 text-pretty flex-1">
                  {textoExcesso}
                </p>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento(PAYMENT_STATES.CUSTODIA)}`}
                >
                  Diferença em análise
                </span>
              </li>,
            );
            return items;
          }

          const valorDivida = valorEmDividaParaExibir(snap, { valor_kz: row.valor });
          const linhaComprovativoPending = linhaMotoristaComprovativoValidacao(nome, valorComprovativo);
          const mostrarLinhaDivida =
            valorDivida > 0
            || (estado !== PAYMENT_STATES.COMPROVATIVO && !linhaComprovativoPending);

          if (mostrarLinhaDivida) {
            const linhaPrincipal = linhaMotoristaValorEmDivida(nome, valorDivida);
            const secundaria = linhaSecundariaMotoristaDias(snap);

            items.push(
              <li
                key={`${row.pagamento_id}-divida`}
                className="p-4 space-y-1"
                data-testid={`motorista-pagamento-${row.passenger_id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white text-pretty">
                      {linhaPrincipal}
                    </p>
                    {secundaria ? (
                      <p className="text-xs text-slate-500 text-pretty" data-testid="motorista-linha-proporcional">
                        {secundaria}
                      </p>
                    ) : null}
                    {linhaPrazo ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200" data-testid="motorista-linha-prazo">
                        {linhaPrazo}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento(row.estado)}`}
                  >
                    {labelEstadoPagamento(row.estado, { placement: 'cabecalho' })}
                  </span>
                </div>
              </li>,
            );
          }

          if (linhaComprovativoPending && estado === PAYMENT_STATES.COMPROVATIVO) {
            items.push(
              <li
                key={`${row.pagamento_id}-comprovativo`}
                className="p-4 flex items-start justify-between gap-3"
                data-testid={`motorista-pagamento-comprovativo-${row.passenger_id}`}
              >
                <p className="text-sm text-slate-800 dark:text-slate-100 text-pretty flex-1">
                  {linhaComprovativoPending}
                </p>
                <span
                  className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${chipClassEstadoPagamento(PAYMENT_STATES.COMPROVATIVO)}`}
                >
                  Em validação
                </span>
              </li>,
            );
          }

          return items;
        })}
      </ul>
    </section>
  );
}

export default AcordoPagamentosMotoristaPanel;
