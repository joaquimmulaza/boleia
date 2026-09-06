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
 * Retenção da plataforma (~10% do GMV on-platform).
 * @param {number} valorKz GMV (quota congelada do acordo).
 * @param {number} [takeRate=TAKE_RATE_PCT]
 * @returns {number}
 */
export function computePlatformFeeKz(valorKz, takeRate = TAKE_RATE_PCT) {
  const valor = Number(valorKz);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Valor do acordo inválido.');
  }
  return Math.floor(valor * takeRate);
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
 * Assiduidade/faltas só activas com pagamento validado on-platform.
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
export function allowsAssiduidadeFaltas(estado) {
  return allowsContactReveal(estado);
}

/**
 * Verifica se todos os passageiros activos têm pagamento em custódia.
 * @param {Array<{ passenger_id?: string, estado?: string }>} pagamentos
 * @param {string[]} passengerIdsRequired IDs dos passageiros activos
 * @returns {boolean}
 */
export function allowsAssiduidadeFaltasForAcordo(pagamentos, passengerIdsRequired) {
  if (!Array.isArray(passengerIdsRequired) || passengerIdsRequired.length === 0) {
    return false;
  }
  const rows = Array.isArray(pagamentos) ? pagamentos : [];
  return passengerIdsRequired.every((pid) => {
    const pg = rows.find((p) => p.passenger_id === pid);
    return pg && allowsAssiduidadeFaltas(pg.estado);
  });
}

/**
 * Repasse líquido ao motorista após descontos de faltas on-platform.
 * @param {number} payoutLiquidoKz Payout após take-rate (do acordo).
 * @param {number} descontoFaltasKz Soma descontos de faltas válidas.
 * @returns {number}
 */
export function computeRepasseLiquidoKz(payoutLiquidoKz, descontoFaltasKz) {
  const payout = Number(payoutLiquidoKz);
  const desconto = Number(descontoFaltasKz);
  if (!Number.isFinite(payout) || payout < 0) {
    throw new Error('Payout líquido inválido.');
  }
  if (!Number.isFinite(desconto) || desconto < 0) {
    throw new Error('Desconto de faltas inválido.');
  }
  return Math.max(0, Math.floor(payout - desconto));
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
/**
 * Estado legível de um repasse motorista registado.
 * @param {{ liquidado_em?: string | null } | null | undefined} repasse
 * @returns {string}
 */
export function labelEstadoRepasse(repasse) {
  if (repasse?.liquidado_em) return 'Liquidado';
  return 'Pendente';
}

/**
 * Classes Tailwind para chip de estado de repasse.
 * @param {{ liquidado_em?: string | null } | null | undefined} repasse
 * @returns {string}
 */
export function chipClassEstadoRepasse(repasse) {
  if (repasse?.liquidado_em) {
    return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100';
  }
  return 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100';
}

/**
 * Resumo de liquidação de período (contagens antes do batch).
 * @param {Array<{ mes_referencia?: string, acordos?: { driver_id?: string } | null }>} custodiaRows
 * @param {string} mesReferencia YYYY-MM-01
 * @returns {{ pagamentos: number, motoristas: number }}
 */
export function resumoLiquidacaoPeriodo(custodiaRows, mesReferencia) {
  const mes = String(mesReferencia || '').slice(0, 10);
  const rows = (Array.isArray(custodiaRows) ? custodiaRows : []).filter(
    (row) => String(row.mes_referencia || '').slice(0, 10) === mes,
  );
  const driverIds = new Set(
    rows.map((row) => row.acordos?.driver_id).filter(Boolean),
  );
  return { pagamentos: rows.length, motoristas: driverIds.size };
}

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
