import { formatKwanza } from './formatKwanza';
import { formatMesAdendaPt } from './adendaStatus';
import { labelEstadoPagamento, PAYMENT_STATES } from './paymentStatus';

/**
 * Snapshot de obrigação mensal (fonte: RPC `build_ui_obrigacao_snapshot` / `get_obrigacao_pagamento_passageiro`).
 * A UI não recalcula valores — só formata o que a BD envia.
 *
 * @typedef {{
 *   dias?: number,
 *   dias_mes?: number,
 *   mes?: string,
 *   quota?: number,
 *   proporcional?: number,
 *   pago?: number,
 *   valor?: number,
 *   valor_em_divida?: number,
 *   prazo?: string | null,
 * }} ObrigacaoSnapshot
 */

/**
 * Normaliza campos da RPC: `quota` (mensal congelada) vs `valor_em_divida` (resto a pagar).
 * @param {ObrigacaoSnapshot | null | undefined} raw
 * @returns {ObrigacaoSnapshot | null}
 */
export function normalizeObrigacaoSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const valorEmDividaRaw = raw.valor_em_divida ?? raw.valor;
  const valorEmDivida = Number(valorEmDividaRaw);
  const quota = Number(raw.quota);
  return {
    ...raw,
    quota: Number.isFinite(quota) ? quota : raw.quota,
    valor_em_divida: Number.isFinite(valorEmDivida) ? valorEmDivida : 0,
    valor: Number.isFinite(valorEmDivida) ? valorEmDivida : raw.valor,
  };
}

/**
 * Valor em dívida para exibição (nunca a quota mensal).
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @param {{ valor_kz?: number } | null | undefined} pagamento
 * @returns {number}
 */
export function valorEmDividaParaExibir(obrigacao, pagamento) {
  const norm = normalizeObrigacaoSnapshot(obrigacao);
  if (norm && norm.valor_em_divida != null) return Number(norm.valor_em_divida) || 0;
  return Number(pagamento?.valor_kz ?? 0) || 0;
}

/**
 * @param {{ requer_resolucao_admin?: boolean } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isPagamentoEmExcessoAnalise(pagamento) {
  return Boolean(pagamento?.requer_resolucao_admin);
}

/**
 * Label do chip no painel passageiro (v1.6 excesso).
 * @param {{ estado?: string, requer_resolucao_admin?: boolean } | null | undefined} pagamento
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @returns {string}
 */
export function labelEstadoPagamentoPassageiro(pagamento, _obrigacao) {
  if (isPagamentoEmExcessoAnalise(pagamento)) {
    return 'Diferença em análise';
  }
  return labelEstadoPagamento(pagamento?.estado, { placement: 'painel' });
}

/**
 * Linha secundária v1.6 — caso excesso («Diferença em análise»).
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @returns {string | null}
 */
export function linhaSecundariaExcessoPassageiro(obrigacao) {
  const norm = normalizeObrigacaoSnapshot(obrigacao);
  if (!norm) return null;
  const dias = Number(norm.dias);
  const diasMes = Number(norm.dias_mes);
  if (!Number.isFinite(diasMes) || diasMes < 1) return null;
  const mesLabel = norm.mes ? formatMesAdendaPt(String(norm.mes).slice(0, 10)) : 'este mês';
  const devido = Number(norm.proporcional);
  if (!Number.isFinite(devido)) return null;
  const diasTxt = Number.isFinite(dias) ? dias : 0;
  return `Os ${formatKwanza(devido)} Kz correspondem a ${diasTxt} de ${diasMes} dias úteis de ${mesLabel}.`;
}

/**
 * Linha v1.4 — quota proporcional do mês (dias úteis decorridos).
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @returns {string | null}
 */
/**
 * Desagregação proporcional só em saída / rescisão (não no acordo activo).
 *
 * @param {string | null | undefined} lugarEstado
 * @param {'S1' | 'S2' | 'S3' | 'S6a' | null | undefined} uiVariant
 * @returns {boolean}
 */
export function mostrarDesagregacaoProporcionalPagamento(lugarEstado, uiVariant) {
  if (uiVariant === 'S2') return true;
  const lugar = String(lugarEstado || '').toLowerCase();
  return lugar === 'saiu';
}

/**
 * Resumo simples no acordo activo ou reservado.
 *
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @param {{ valor_kz?: number } | null | undefined} pagamento
 * @returns {string}
 */
export function linhaValorAPagarResumo(obrigacao, pagamento) {
  const valor = valorEmDividaParaExibir(obrigacao, pagamento);
  return `Valor a pagar: ${formatKwanza(valor)} Kz`;
}

/**
 * @param {ObrigacaoSnapshot | null | undefined} obrigacao
 * @param {{
 *   pagamentoEstado?: string | null,
 *   valorComprovativo?: number | null,
 * }} [options]
 * @returns {string | null}
 */
export function linhaProporcionalPagamento(obrigacao, options = {}) {
  const norm = normalizeObrigacaoSnapshot(obrigacao);
  if (!norm) return null;
  const dias = Number(norm.dias);
  const diasMes = Number(norm.dias_mes);
  if (!Number.isFinite(diasMes) || diasMes < 1) return null;
  const mesLabel = norm.mes ? formatMesAdendaPt(String(norm.mes).slice(0, 10)) : 'este mês';
  const proporcional = Number(norm.proporcional);
  const pago = Number(norm.pago) || 0;
  const valorEmDivida = Number(norm.valor_em_divida) || 0;
  const diasTxt = Number.isFinite(dias) ? dias : 0;
  const pagamentoEstado = String(options.pagamentoEstado || '').toLowerCase();
  const valorComprovativo = Number(options.valorComprovativo);
  let linhaPago;
  if (pagamentoEstado === PAYMENT_STATES.COMPROVATIVO) {
    const valorValidacao = Number.isFinite(valorComprovativo) && valorComprovativo > 0
      ? valorComprovativo
      : (pago > 0 ? pago : valorEmDivida);
    linhaPago = `comprovativo de ${formatKwanza(valorValidacao)} Kz em validação`;
  } else {
    linhaPago = `Já pago ${formatKwanza(pago)} Kz`;
  }
  return (
    `${diasTxt} de ${diasMes} dias úteis em ${mesLabel} · `
    + `Proporcional ${formatKwanza(proporcional)} Kz · `
    + `${linhaPago} · `
    + `A pagar ${formatKwanza(valorEmDivida)} Kz`
  );
}

/**
 * Prazo de pagamento / reserva (ISO timestamptz da BD).
 * @param {string | null | undefined} prazoIso
 * @returns {string | null}
 */
/**
 * Data legível para prazo (sem hora — Figma «até {data}»).
 * @param {string | null | undefined} prazoIso
 * @returns {string | null}
 */
export function formatDataPrazoPagamento(prazoIso) {
  if (!prazoIso) return null;
  const d = new Date(prazoIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Luanda',
  });
}

/**
 * Prazo de pagamento / reserva — texto fixo «até {data}» (sem countdown).
 * @param {string | null | undefined} prazoIso
 * @returns {string | null}
 */
export function linhaPrazoPagamento(prazoIso) {
  const data = formatDataPrazoPagamento(prazoIso);
  if (!data) return null;
  return `até ${data}`;
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
 * @param {{ estado?: string, valor_kz?: number, valor_quota_original_kz?: number } | null | undefined} pagamento
 * @param {ObrigacaoSnapshot | null | undefined} [obrigacao]
 * @returns {{ texto: string, anulado: boolean }}
 */
export function valorHistoricoPagamento(pagamento, obrigacao) {
  const estado = String(pagamento?.estado || '').toLowerCase();
  const anulado = estado === 'anulado';
  const valor = anulado
    ? Number(pagamento?.valor_quota_original_kz ?? pagamento?.valor_kz ?? 0)
    : valorEmDividaParaExibir(obrigacao, pagamento);
  return {
    texto: `${formatKwanza(valor)} Kz`,
    anulado,
  };
}

/**
 * Ícone ✓ só em estados «fechados» sem dívida nem expirado (v1.6).
 * @param {{
 *   pagamento?: { estado?: string, requer_resolucao_admin?: boolean } | null,
 *   obrigacao?: ObrigacaoSnapshot | null,
 *   lugarEstado?: string | null,
 * }} ctx
 * @returns {boolean}
 */
export function mostrarIconeSucessoPagamento(ctx) {
  const lugar = String(ctx.lugarEstado || '').toLowerCase();
  if (lugar === 'expirado') return false;

  const pagamento = ctx.pagamento;
  if (isPagamentoEmExcessoAnalise(pagamento)) return false;

  const estado = String(pagamento?.estado || '').toLowerCase();
  const valorDivida = valorEmDividaParaExibir(ctx.obrigacao, pagamento);

  if (valorDivida > 0) return false;
  if (estado === PAYMENT_STATES.PENDENTE || estado === PAYMENT_STATES.COMPROVATIVO) return false;
  if (lugar === 'saiu' && (estado === PAYMENT_STATES.PENDENTE || estado === PAYMENT_STATES.COMPROVATIVO)) {
    return false;
  }

  return estado === PAYMENT_STATES.CUSTODIA
    || estado === PAYMENT_STATES.LIQUIDADO
    || estado === PAYMENT_STATES.REEMBOLSADO;
}

/**
 * @param {string | null | undefined} lugarEstado
 * @param {{ estado?: string } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isDestaqueValorEmDividaSaiuPendente(lugarEstado, pagamento) {
  const lugar = String(lugarEstado || '').toLowerCase();
  if (lugar !== 'saiu') return false;
  const e = String(pagamento?.estado || '').toLowerCase();
  return e === PAYMENT_STATES.PENDENTE || e === PAYMENT_STATES.COMPROVATIVO;
}

/**
 * Cabeçalho secção pagamentos motorista (v1.6).
 * @param {{ acordoTerminado?: boolean, multipleSections?: boolean }} opts
 * @returns {string}
 */
export function tituloSecaoPagamentosMotorista(opts = {}) {
  if (opts.acordoTerminado) {
    return opts.multipleSections ? 'Pagamentos deste acordo' : 'Pagamentos';
  }
  return 'Pagamentos do mês';
}
