import {
  ADENDA_TIMEZONE,
  firstDayCurrentMonthLuanda,
  firstDayNextMonthLuanda,
} from './adendaEffectiveFrom';
import {
  minDataFaltaPassageiroProprioLuanda,
  isPassageiroProprioFaltaDataSubmissivel,
} from './passageiroFaltaPrazo';

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
 * Primeiro dia do mês (YYYY-MM-01) a partir de YYYY-MM-DD.
 * @param {string} isoDate
 * @returns {string}
 */
export function firstDayOfMonthFromIso(isoDate) {
  const iso = String(isoDate || '').slice(0, 10);
  const match = /^(\d{4})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[1]}-${match[2]}-01`;
}

/**
 * Mês de liquidação do desconto (alinhado a `_desconto_faltas_pagamento` SQL).
 * @param {{ data_falta?: string, desconto_mes_referencia?: string | null }} falta
 * @returns {string}
 */
export function descontoMesReferenciaFalta(falta) {
  const explicit = String(falta?.desconto_mes_referencia || '').slice(0, 10);
  if (explicit) return explicit;
  return firstDayOfMonthFromIso(falta?.data_falta);
}

/**
 * Faltas cujo desconto liquida no mês corrente (Luanda), independentemente de `data_falta`.
 * @param {Array<{ data_falta?: string, desconto_mes_referencia?: string | null }>} faltas
 * @param {Date} [refDate]
 * @returns {Array}
 */
export function filterFaltasDescontoMesAtual(faltas, refDate = new Date()) {
  const mesAtual = firstDayCurrentMonthLuanda(refDate);
  return (faltas || []).filter(
    (f) => descontoMesReferenciaFalta(f) === mesAtual,
  );
}

/**
 * Amanhã em Luanda (YYYY-MM-DD).
 * @param {Date} [refDate]
 * @returns {string}
 */
export function tomorrowLuandaISO(refDate = new Date()) {
  const today = todayLuandaISO(refDate);
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return luandaDateFmt.format(d);
}

export {
  minDataFaltaPassageiroProprioLuanda as minDataFaltaPassageiroLuanda,
  isPassageiroProprioFaltaDataSubmissivel as isPassageiroFaltaDataSubmissivel,
};

/**
 * Limites min/max do input date no modal.
 * @param {{ isPassageiroLocked: boolean, refDate?: Date }} opts
 * @returns {{ min: string, max?: string }}
 */
export function resolveLogAbsenceDateBounds({ isPassageiroLocked, refDate = new Date() }) {
  if (isPassageiroLocked) {
    return { min: minDataFaltaPassageiroProprioLuanda(refDate) };
  }
  return {
    min: firstDayCurrentMonthLuanda(refDate),
    max: todayLuandaISO(refDate),
  };
}

/**
 * @param {{ tipo?: string }} falta
 * @returns {boolean}
 */
function isFaltaTipoMotorista(falta) {
  return String(falta?.tipo || '').toLowerCase() === 'motorista';
}

/**
 * Soma descontos das faltas do mês visíveis para um passageiro (inclui faltas do motorista).
 * @param {Array<{ tipo?: string, passenger_id?: string, desconto_kz?: number }>} faltas
 * @param {string | null | undefined} passengerId
 * @returns {number}
 */
export function sumDescontoFaltasParaPassageiro(faltas, passengerId) {
  const pid = passengerId;
  return (faltas || []).reduce((acc, falta) => {
    const valor = Number(falta.desconto_kz) || 0;
    if (isFaltaTipoMotorista(falta)) return acc + valor;
    if (pid && falta.passenger_id === pid) return acc + valor;
    return acc;
  }, 0);
}

/**
 * @param {{ acordos_passageiros?: Array<{ estado?: string }> } | null | undefined} acordo
 * @returns {number}
 */
export function countPassageirosActivosAcordo(acordo) {
  return (acordo?.acordos_passageiros || []).filter(
    (p) => String(p.estado || '').toLowerCase() === 'activo',
  ).length;
}

/**
 * Total client-side na visão motorista: falta Motorista × passageiros activos; restantes uma vez.
 * @param {Array<{ tipo?: string, desconto_kz?: number }>} faltas
 * @param {number} nPassageirosActivos
 * @returns {number}
 */
export function sumDescontoFaltasVisaoMotorista(faltas, nPassageirosActivos) {
  const n = Math.max(0, Number(nPassageirosActivos) || 0);
  return (faltas || []).reduce((acc, falta) => {
    const valor = Number(falta.desconto_kz) || 0;
    if (isFaltaTipoMotorista(falta)) return acc + valor * n;
    return acc + valor;
  }, 0);
}

/**
 * Desconto efectivo de uma falta Motorista na lista (motorista) ou unitário (passageiro).
 * @param {{ tipo?: string, desconto_kz?: number }} falta
 * @param {number} nPassageirosActivos
 * @param {'Passageiro' | 'Motorista' | undefined} tipoPerfil
 * @returns {number}
 */
export function resolveDescontoLinhaFalta(falta, nPassageirosActivos, tipoPerfil) {
  const valor = Number(falta?.desconto_kz) || 0;
  if (tipoPerfil === 'Motorista' && isFaltaTipoMotorista(falta)) {
    const n = Math.max(0, Number(nPassageirosActivos) || 0);
    return valor * n;
  }
  return valor;
}

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function isPagamentoLiquidado(estado) {
  return String(estado || '').toLowerCase() === 'liquidado';
}

/**
 * «Total a descontar» — Maestro (a): liquidado → `desconto_faltas_kz`; senão soma das faltas do mês.
 * Motorista: falta tipo Motorista desconta por cada passageiro activo (regra 4).
 *
 * @param {Array<{ passenger_id?: string, mes_referencia?: string, desconto_faltas_kz?: number, estado?: string }>} pagamentos
 * @param {Array<{ tipo?: string, passenger_id?: string, desconto_kz?: number }>} faltasEsteMes
 * @param {{
 *   tipoPerfil?: 'Passageiro' | 'Motorista',
 *   passengerId?: string | null,
 *   nPassageirosActivos?: number,
 *   refDate?: Date,
 * }} [options]
 * @returns {number}
 */
export function resolveDescontoFaltasTotal(pagamentos, faltasEsteMes, options = {}) {
  const mes = firstDayCurrentMonthLuanda(options.refDate ?? new Date());
  const rows = (pagamentos || []).filter(
    (row) => String(row.mes_referencia || '').slice(0, 10) === mes,
  );
  const faltas = faltasEsteMes || [];

  if (options.tipoPerfil === 'Motorista') {
    const liquidadoRows = rows.filter((row) => isPagamentoLiquidado(row.estado));
    if (liquidadoRows.length > 0 && liquidadoRows.length === rows.length) {
      return liquidadoRows.reduce(
        (acc, row) => acc + (Number(row.desconto_faltas_kz) || 0),
        0,
      );
    }
    const nActivos = options.nPassageirosActivos ?? 0;
    return sumDescontoFaltasVisaoMotorista(faltas, nActivos);
  }

  const pid = options.passengerId;
  const row = pid ? rows.find((r) => r.passenger_id === pid) : null;
  if (row && isPagamentoLiquidado(row.estado)) {
    return Number(row.desconto_faltas_kz) || 0;
  }
  return sumDescontoFaltasParaPassageiro(faltas, pid);
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
