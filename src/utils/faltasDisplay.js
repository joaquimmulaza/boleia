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

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Dia curto do histórico («2 Out»), a partir de YYYY-MM-DD.
 * @param {string} dataFalta
 * @returns {string}
 */
export function formatFaltaDiaCurto(dataFalta) {
  const iso = String(dataFalta || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = Number(match[2]);
  const day = Number(match[3]);
  const label = MESES_CURTOS[month - 1];
  if (!label || !day) return iso;
  return `${day} ${label}`;
}

/**
 * Cartão do hub de faltas. A rota só existe com origem e destino reais.
 * O número de pessoas não decide a rota.
 * @param {{
 *   n_passageiros_contrato?: number,
 *   valor_mensal_por_passageiro_kz?: number | null,
 *   ofertas_capacidade?: {
 *     origin_name?: string | null,
 *     destination_name?: string | null,
 *     flexibilidade_rota?: boolean,
 *   } | null,
 * }} acordo
 * @returns {{
 *   titulo: string,
 *   rota: { origem: string, destino: string } | null,
 *   precoKz: number | null,
 * }}
 */
export function resolveFaltasHubCard(acordo) {
  const oferta = acordo?.ofertas_capacidade || {};
  const origem = String(oferta.origin_name || '').trim();
  const destino = String(oferta.destination_name || '').trim();
  const rota = origem && destino ? { origem, destino } : null;
  const flexivel = oferta.flexibilidade_rota === true
    || (oferta.flexibilidade_rota !== false && !rota);
  const n = Number(acordo?.n_passageiros_contrato) || 0;
  const pessoas = n === 1 ? '1 pessoa' : `${n} pessoas`;

  return {
    titulo: `${flexivel ? 'Acordo flexível' : 'Acordo fixo'} · ${pessoas}`,
    rota,
    precoKz: acordo?.valor_mensal_por_passageiro_kz ?? null,
  };
}
