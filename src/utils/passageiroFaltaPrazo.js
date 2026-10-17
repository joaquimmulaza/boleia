import { ADENDA_TIMEZONE } from './adendaEffectiveFrom';

const luandaDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ADENDA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const luandaClockFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ADENDA_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * @param {Date} [refDate]
 * @returns {string}
 */
export function todayLuandaISO(refDate = new Date()) {
  return luandaDateFmt.format(refDate);
}

/**
 * @param {Date} [refDate]
 * @returns {string}
 */
export function tomorrowLuandaISO(refDate = new Date()) {
  const today = todayLuandaISO(refDate);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return luandaDateFmt.format(d);
}

/**
 * Hora local Luanda (HH, mm) a partir de um instante injectável.
 * @param {Date} [refDate]
 * @returns {{ hour: number, minute: number }}
 */
export function luandaClockParts(refDate = new Date()) {
  const parts = luandaClockFmt.formatToParts(refDate);
  /** @type {Record<string, string>} */
  const map = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  return {
    hour: Number(map.hour) || 0,
    minute: Number(map.minute) || 0,
  };
}

/**
 * Antes das 22:00 em Luanda (22:00 inclusive desactiva «amanhã»).
 * @param {Date} [refDate]
 * @returns {boolean}
 */
export function isBeforePassageiroPrazoCutoffLuanda(refDate = new Date()) {
  const { hour } = luandaClockParts(refDate);
  return hour < 22;
}

/**
 * Soma dias a YYYY-MM-DD (calendário, meio-dia UTC estável).
 * @param {string} isoDate
 * @param {number} days
 * @returns {string}
 */
export function addDaysLuandaISO(isoDate, days) {
  const base = String(isoDate || '').slice(0, 10);
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return luandaDateFmt.format(d);
}

/**
 * Primeira data seleccionável — passageiro na própria vaga (regra 22:00 véspera).
 * @param {Date} [refDate]
 * @returns {string}
 */
export function minDataFaltaPassageiroProprioLuanda(refDate = new Date()) {
  const today = todayLuandaISO(refDate);
  if (isBeforePassageiroPrazoCutoffLuanda(refDate)) {
    return tomorrowLuandaISO(refDate);
  }
  return addDaysLuandaISO(today, 2);
}

/**
 * @param {string} dataFalta
 * @param {Date} [refDate]
 * @returns {boolean}
 */
export function isPassageiroProprioFaltaDataSubmissivel(dataFalta, refDate = new Date()) {
  const iso = String(dataFalta || '').slice(0, 10);
  if (!iso) return false;
  const min = minDataFaltaPassageiroProprioLuanda(refDate);
  return iso >= min;
}

/** Copy aprovada (PM + Critiquito) — linha fixa sob a data, passageiro na própria vaga. */
export const PASSAGEIRO_FALTA_PRAZO_COPY = 'Avisa até às 22:00 do dia anterior.';
