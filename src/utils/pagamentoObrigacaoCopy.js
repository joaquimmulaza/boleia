import { formatKwanza } from './formatKwanza';
import { formatMesAdendaPt } from './adendaStatus';

/**
 * Snapshot de obrigação mensal (fonte: RPC `build_ui_obrigacao_snapshot` / `get_obrigacao_pagamento_passageiro`).
 * A UI não recalcula valores — só formata o que a BD envia.
 *
 * @typedef {{
 *   dias?: number,
 *   dias_mes?: number,
 *   mes?: string,
 *   proporcional?: number,
 *   pago?: number,
 *   valor?: number,
 *   prazo?: string | null,
 * }} ObrigacaoSnapshot
 */

/**
 * Linha v1.4 — quota proporcional do mês (dias úteis decorridos).
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @returns {string | null}
 */
export function linhaProporcionalPagamento(obrigacao) {
  if (!obrigacao || typeof obrigacao !== 'object') return null;
  const dias = Number(obrigacao.dias);
  const diasMes = Number(obrigacao.dias_mes);
  if (!Number.isFinite(diasMes) || diasMes < 1) return null;
  const mesLabel = obrigacao.mes ? formatMesAdendaPt(String(obrigacao.mes).slice(0, 10)) : 'este mês';
  const proporcional = Number(obrigacao.proporcional);
  const pago = Number(obrigacao.pago) || 0;
  const valor = Number(obrigacao.valor) || 0;
  const diasTxt = Number.isFinite(dias) ? dias : 0;
  return (
    `${diasTxt} de ${diasMes} dias úteis em ${mesLabel} · `
    + `Proporcional ${formatKwanza(proporcional)} Kz · `
    + `Já pago ${formatKwanza(pago)} Kz · `
    + `A pagar ${formatKwanza(valor)} Kz`
  );
}

/**
 * Prazo de pagamento / reserva (ISO timestamptz da BD).
 * @param {string | null | undefined} prazoIso
 * @returns {string | null}
 */
export function linhaPrazoPagamento(prazoIso) {
  if (!prazoIso) return null;
  const d = new Date(prazoIso);
  if (Number.isNaN(d.getTime())) return null;
  return `Prazo: ${d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Luanda',
  })}`;
}

/**
 * Histórico v1.5 — título «Pagamento de {mes}…».
 * @param {string | null | undefined} mesReferencia YYYY-MM-DD
 * @returns {string}
 */
export function tituloHistoricoPagamento(mesReferencia) {
  const mes = String(mesReferencia || '').slice(0, 10);
  if (!mes) return 'Pagamento';
  return `Pagamento de ${formatMesAdendaPt(mes)}`;
}

/**
 * Valor a mostrar no histórico (riscado se anulado).
 * @param {{ estado?: string, valor_kz?: number } | null | undefined} pagamento
 * @param {ObrigacaoSnapshot | null | undefined} [obrigacao]
 * @returns {{ texto: string, anulado: boolean }}
 */
export function valorHistoricoPagamento(pagamento, obrigacao) {
  const estado = String(pagamento?.estado || '').toLowerCase();
  const anulado = estado === 'anulado';
  const valor = anulado
    ? Number(pagamento?.valor_quota_original_kz ?? pagamento?.valor_kz ?? 0)
    : Number(obrigacao?.valor ?? pagamento?.valor_kz ?? 0);
  return {
    texto: `${formatKwanza(valor)} Kz`,
    anulado,
  };
}
