/**
 * Estados de pagamento mensal por lugar (PACOTE ENG #5).
 * Valores monetários vêm sempre do acordo — nunca defaults da plataforma.
 */

/** Take-rate ~10% documentado para cálculo de payout líquido ao motorista. */
export const TAKE_RATE_PCT = 0.1;

export const PAYMENT_STATES = Object.freeze({
  PENDENTE: 'pendente_pagamento',
  COMPROVATIVO: 'comprovativo_enviado',
  CUSTODIA: 'em_custodia',
  LIQUIDADO: 'liquidado',
  REEMBOLSADO: 'reembolsado',
});

/** @type {Readonly<Record<string, readonly string[]>>} */
const ALLOWED_TRANSITIONS = Object.freeze({
  pendente_pagamento: ['comprovativo_enviado'],
  comprovativo_enviado: ['em_custodia', 'pendente_pagamento'],
  em_custodia: ['liquidado', 'reembolsado'],
  liquidado: [],
  reembolsado: [],
});

/**
 * Payout líquido ao motorista após take-rate (~10%).
 * @param {number} valorKz Valor do acordo (quota congelada).
 * @param {number} [takeRate=TAKE_RATE_PCT]
 * @returns {number}
 */
export function computePayoutLiquidoKz(valorKz, takeRate = TAKE_RATE_PCT) {
  const valor = Number(valorKz);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Valor do acordo inválido.');
  }
  return Math.floor(valor * (1 - takeRate));
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function allowsContactReveal(estado) {
  const e = String(estado || '').toLowerCase();
  return e === PAYMENT_STATES.CUSTODIA || e === PAYMENT_STATES.LIQUIDADO;
}

/**
 * @param {string | null | undefined} from
 * @param {string | null | undefined} to
 * @returns {boolean}
 */
export function canTransitionPayment(from, to) {
  const f = String(from || '').toLowerCase();
  const t = String(to || '').toLowerCase();
  const allowed = ALLOWED_TRANSITIONS[f];
  return Array.isArray(allowed) && allowed.includes(t);
}

/**
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function labelEstadoPagamento(estado) {
  const e = String(estado || '').toLowerCase();
  switch (e) {
    case PAYMENT_STATES.PENDENTE:
      return 'Pagamento pendente';
    case PAYMENT_STATES.COMPROVATIVO:
      return 'Comprovativo enviado';
    case PAYMENT_STATES.CUSTODIA:
      return 'Em custódia';
    case PAYMENT_STATES.LIQUIDADO:
      return 'Liquidado';
    case PAYMENT_STATES.REEMBOLSADO:
      return 'Reembolsado';
    default:
      return estado || '—';
  }
}

/**
 * Explicação curta do estado (glossário UI).
 * @param {string | null | undefined} estado
 * @returns {string | null}
 */
export function helpEstadoPagamento(estado) {
  const e = String(estado || '').toLowerCase();
  switch (e) {
    case PAYMENT_STATES.CUSTODIA:
      return 'Valor recebido e retido pela plataforma até libertar ao motorista.';
    case PAYMENT_STATES.LIQUIDADO:
      return 'Pagamento transferido ao motorista após o ciclo.';
    case PAYMENT_STATES.PENDENTE:
      return 'Aguarda transferência para o IBAN da plataforma.';
    case PAYMENT_STATES.COMPROVATIVO:
      return 'Comprovativo enviado — aguarda validação.';
    case PAYMENT_STATES.REEMBOLSADO:
      return 'Valor devolvido ao passageiro.';
    default:
      return null;
  }
}

/**
 * Classes Tailwind para chip de estado de pagamento.
 * @param {string | null | undefined} estado
 * @returns {string}
 */
export function chipClassEstadoPagamento(estado) {
  const e = String(estado || '').toLowerCase();
  switch (e) {
    case PAYMENT_STATES.PENDENTE:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    case PAYMENT_STATES.COMPROVATIVO:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
    case PAYMENT_STATES.CUSTODIA:
      return 'bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100';
    case PAYMENT_STATES.LIQUIDADO:
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100';
    case PAYMENT_STATES.REEMBOLSADO:
      return 'bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}
