import { DIAS_UTEIS_DEFAULT } from './diasSemana.js';

/**
 * Dia da semana ISO (1=Seg … 7=Dom) a partir de YYYY-MM-DD.
 * @param {string} isoDate
 * @returns {number}
 */
export function isoDowFromIsoDate(isoDate) {
  const iso = String(isoDate || '').slice(0, 10);
  const d = new Date(`${iso}T12:00:00Z`);
  const utc = d.getUTCDay();
  return utc === 0 ? 7 : utc;
}

/**
 * @param {number[] | null | undefined} diasSemana
 * @returns {number[]}
 */
export function normalizeDiasSemanaAcordo(diasSemana) {
  if (Array.isArray(diasSemana) && diasSemana.length > 0) {
    const normalized = [...new Set(
      diasSemana
        .map((d) => Number(d))
        .filter((d) => Number.isInteger(d) && d >= 1 && d <= 7),
    )].sort((a, b) => a - b);
    if (normalized.length > 0) return normalized;
  }
  return [...DIAS_UTEIS_DEFAULT];
}

/**
 * @param {string} isoDate — YYYY-MM-DD
 * @param {number[] | null | undefined} diasSemana
 * @returns {boolean}
 */
export function isDataDiaViagemAcordo(isoDate, diasSemana) {
  const iso = String(isoDate || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const allowed = normalizeDiasSemanaAcordo(diasSemana);
  return allowed.includes(isoDowFromIsoDate(iso));
}

/**
 * Dias de viagem do acordo num mês (YYYY-MM-01).
 * @param {string} mesInicio — YYYY-MM-01
 * @param {number[] | null | undefined} diasSemana
 * @returns {number}
 */
export function countDiasViagemMes(mesInicio, diasSemana) {
  const base = String(mesInicio || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-01$/.exec(base);
  if (!match) return 0;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const allowed = normalizeDiasSemanaAcordo(diasSemana);
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${match[1]}-${match[2]}-${String(day).padStart(2, '0')}`;
    if (allowed.includes(isoDowFromIsoDate(iso))) count += 1;
  }
  return count;
}
