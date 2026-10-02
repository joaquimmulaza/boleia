import { ADENDA_TIMEZONE } from './adendaEffectiveFrom.js';
import { formatKwanza } from './formatKwanza.js';

/** Dia do mês (Luanda) até ao qual se pode propor preço para o mês seguinte. */
export const PROPOSTA_PRECO_DIA_LIMITE = 28;

const luandaDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ADENDA_TIMEZONE,
  day: 'numeric',
});

const mesLongFormatter = new Intl.DateTimeFormat('pt-PT', {
  month: 'long',
  timeZone: ADENDA_TIMEZONE,
});

const mesAnoFormatter = new Intl.DateTimeFormat('pt-PT', {
  month: 'long',
  year: 'numeric',
  timeZone: ADENDA_TIMEZONE,
});

/**
 * @param {Date} [fromDate]
 * @returns {number}
 */
export function getLuandaDayOfMonth(fromDate = new Date()) {
  return Number.parseInt(luandaDayFormatter.format(fromDate), 10);
}

/**
 * @param {Date} [fromDate]
 * @returns {boolean}
 */
export function isJanelaPropostaPrecoAberta(fromDate = new Date()) {
  return getLuandaDayOfMonth(fromDate) <= PROPOSTA_PRECO_DIA_LIMITE;
}

/**
 * @param {string} mesActualLabel ex. «Outubro»
 * @returns {string}
 */
export function copyBadgeJanelaAberta(mesActualLabel) {
  return `Até dia ${PROPOSTA_PRECO_DIA_LIMITE} · ${mesActualLabel} mantém-se`;
}

/**
 * @returns {string}
 */
export function copyBadgeJanelaFechada() {
  return 'Janela de propostas fechada';
}

/**
 * @param {Date} [fromDate]
 * @returns {string}
 */
export function labelMesActualPt(fromDate = new Date()) {
  const raw = mesAnoFormatter.format(fromDate);
  if (!raw) return 'este mês';
  const [mes] = raw.split(' de ');
  return mes ? mes.charAt(0).toUpperCase() + mes.slice(1) : raw;
}

/**
 * @param {string | null | undefined} isoDate YYYY-MM-DD (effective_from)
 * @returns {string}
 */
export function formatEffectiveFromLongPt(isoDate) {
  if (!isoDate) return 'próximo mês';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 'próximo mês';
  const dia = d.getUTCDate();
  const mes = mesLongFormatter.format(d);
  return `A partir de ${dia} de ${mes.charAt(0).toUpperCase()}${mes.slice(1)}`;
}

/**
 * @param {string | null | undefined} isoDate
 * @returns {string}
 */
export function formatEffectiveFromShortPt(isoDate) {
  if (!isoDate) return '—';
  const d = new Date(`${String(isoDate).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  const dia = d.getUTCDate();
  const mes = d.getUTCMonth() + 1;
  return `${dia}/${String(mes).padStart(2, '0')}`;
}

/**
 * @param {number} actual
 * @param {number} proposed
 * @returns {string}
 */
export function formatPrecoDiffPt(actual, proposed) {
  const diff = proposed - actual;
  if (diff === 0) return 'Sem alteração';
  const sinal = diff > 0 ? '+' : '−';
  const abs = Math.abs(diff);
  return `${sinal}${formatKwanza(abs)} Kz / mês`;
}
