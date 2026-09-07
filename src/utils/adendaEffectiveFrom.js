/** Fuso horário canónico dos acordos Boleia (Luanda). */
export const ADENDA_TIMEZONE = 'Africa/Luanda';

/**
 * 1.º dia do mês corrente em Africa/Luanda (YYYY-MM-DD).
 *
 * @param {Date} [fromDate]
 * @returns {string}
 */
export function firstDayCurrentMonthLuanda(fromDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADENDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fromDate);

  /** @type {Record<string, string>} */
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  return `${map.year}-${map.month}-01`;
}

/**
 * 1.º dia do mês seguinte em Africa/Luanda (YYYY-MM-DD).
 * Espelha `date_trunc('month', timezone('Africa/Luanda', now())) + interval '1 month'` na BD.
 *
 * @param {Date} [fromDate] — instante de referência (default: agora)
 * @returns {string}
 */
export function firstDayNextMonthLuanda(fromDate = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADENDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(fromDate);

  /** @type {Record<string, string>} */
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  const year = Number.parseInt(map.year, 10);
  const month = Number.parseInt(map.month, 10);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
}

/**
 * Indica se a adenda aceite ainda não deve mutar o acordo live (mês corrente).
 *
 * @param {string} effectiveFrom — YYYY-MM-DD
 * @param {Date} [today]
 * @returns {boolean}
 */
export function isAdendaBeforeEffectiveFrom(effectiveFrom, today = new Date()) {
  const todayLuanda = new Intl.DateTimeFormat('en-CA', {
    timeZone: ADENDA_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);

  return todayLuanda < effectiveFrom;
}
