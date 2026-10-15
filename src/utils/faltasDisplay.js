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
 * Falta pertence ao mês corrente em Luanda (inclui datas futuras no mês).
 * @param {string} dataFalta
 * @param {Date} [refDate]
 * @returns {boolean}
 */
export function isFaltaEsteMes(dataFalta, refDate = new Date()) {
  const iso = String(dataFalta || '').slice(0, 10);
  if (!iso) return false;

  const monthStart = firstDayCurrentMonthLuanda(refDate);
  const monthEndExclusive = firstDayNextMonthLuanda(refDate);

  return iso >= monthStart && iso < monthEndExclusive;
}

/**
 * Falta pertence ao mês corrente em Luanda e não é futura (validação de registo).
 * @param {string} dataFalta
 * @param {Date} [refDate]
 * @returns {boolean}
 */
export function isFaltaEsteMesAteHoje(dataFalta, refDate = new Date()) {
  const iso = String(dataFalta || '').slice(0, 10);
  if (!iso) return false;
  return isFaltaEsteMes(iso, refDate) && iso <= todayLuandaISO(refDate);
}

/**
 * @param {Array<{ data_falta?: string, desconto_kz?: number }>} faltas
 * @param {Date} [refDate]
 * @returns {Array}
 */
export function filterFaltasEsteMes(faltas, refDate = new Date()) {
  return (faltas || []).filter((f) => isFaltaEsteMes(f.data_falta, refDate));
}

/**
 * «Total a descontar» — valor persistido em pagamentos_acordo.desconto_faltas_kz
 * (calculado na BD via _desconto_faltas_pagamento); nunca somar faltas no cliente.
 *
 * @param {Array<{ passenger_id?: string, mes_referencia?: string, desconto_faltas_kz?: number }>} pagamentos
 * @param {{
 *   tipoPerfil?: 'Passageiro' | 'Motorista',
 *   passengerId?: string | null,
 *   refDate?: Date,
 * }} [options]
 * @returns {number}
 */
export function resolveDescontoFaltasTotalServidor(pagamentos, options = {}) {
  const mes = firstDayCurrentMonthLuanda(options.refDate ?? new Date());
  const rows = (pagamentos || []).filter(
    (row) => String(row.mes_referencia || '').slice(0, 10) === mes,
  );

  if (options.tipoPerfil === 'Motorista') {
    return rows.reduce(
      (acc, row) => acc + (Number(row.desconto_faltas_kz) || 0),
      0,
    );
  }

  const pid = options.passengerId;
  if (!pid) return 0;
  const row = rows.find((r) => r.passenger_id === pid);
  return Number(row?.desconto_faltas_kz) || 0;
}

/** Classes partilhadas entre total e linhas do histórico. */
export const DESCONTO_FALTA_AMOUNT_CLASS =
  'tabular-nums text-slate-900 dark:text-white';

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
