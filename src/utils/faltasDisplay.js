import {
  ADENDA_TIMEZONE,
  firstDayCurrentMonthLuanda,
  firstDayNextMonthLuanda,
} from './adendaEffectiveFrom';

const luandaDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ADENDA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Data de hoje em Africa/Luanda (YYYY-MM-DD).
 * @param {Date} [refDate]
 * @returns {string}
 */
export function todayLuandaISO(refDate = new Date()) {
  return luandaDateFmt.format(refDate);
}

/**
 * @param {string} dataFalta — YYYY-MM-DD
 * @param {Date} [refDate]
 * @returns {boolean}
 */
export function isFutureFaltaDate(dataFalta, refDate = new Date()) {
  const iso = String(dataFalta || '').slice(0, 10);
  if (!iso) return false;
  return iso > todayLuandaISO(refDate);
}

/**
 * Falta pertence ao mês corrente em Luanda e não é futura.
 * @param {string} dataFalta
 * @param {Date} [refDate]
 * @returns {boolean}
 */
export function isFaltaEsteMesAteHoje(dataFalta, refDate = new Date()) {
  const iso = String(dataFalta || '').slice(0, 10);
  if (!iso) return false;

  const monthStart = firstDayCurrentMonthLuanda(refDate);
  const monthEndExclusive = firstDayNextMonthLuanda(refDate);

  return iso >= monthStart && iso < monthEndExclusive && iso <= todayLuandaISO(refDate);
}

/**
 * @param {Array<{ data_falta?: string, desconto_kz?: number }>} faltas
 * @param {Date} [refDate]
 * @returns {Array}
 */
export function filterFaltasEsteMes(faltas, refDate = new Date()) {
  return (faltas || []).filter((f) => isFaltaEsteMesAteHoje(f.data_falta, refDate));
}

/**
 * @param {Array<{ desconto_kz?: number }>} faltas
 * @returns {number}
 */
export function sumDescontoFaltas(faltas) {
  return (faltas || []).reduce(
    (acc, falta) => acc + (Number(falta.desconto_kz) || 0),
    0,
  );
}
