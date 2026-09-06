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
