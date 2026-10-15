import { countDiasViagemMes } from './faltasDiasAcordo.js';

/**
 * Desconto de falta por dia útil (MKT-07 / G9) — política meia quota.
 * Alinhado a SQL `handle_falta_desconto`:
 * - `ambas` → ROUND(quota / dias, 2)
 * - `ida` | `regresso` → ROUND(quota / dias / 2, 2)
 *
 * @param {number} quotaMensalKz Quota mensal do passageiro (Kz)
 * @param {number} diasDivisor Dias de viagem do mês (count_dias_viagem_mes)
 * @param {'ida'|'regresso'|'ambas'} [viagem='ambas']
 * @returns {number} Desconto em Kz com 2 casas decimais
 */
export function computeFaltaDesconto(quotaMensalKz, diasDivisor, viagem = 'ambas') {
  const quota = Number(quotaMensalKz);
  const dias = Number(diasDivisor);
  if (!Number.isFinite(quota) || !Number.isFinite(dias) || dias === 0) {
    throw new Error('Quota e dias de viagem do mês devem ser números válidos (dias ≠ 0).');
  }
  const v = String(viagem || 'ambas').toLowerCase();
  if (v !== 'ida' && v !== 'regresso' && v !== 'ambas') {
    throw new Error('Viagem inválida. Use ida, regresso ou ambas.');
  }
  const diaInteiro = Math.round((quota / dias) * 100) / 100;
  if (v === 'ambas') return diaInteiro;
  return Math.round((quota / dias / 2) * 100) / 100;
}

/**
 * Preview alinhado ao trigger: divisor = dias de viagem do mês civil da data (oferta.dias_semana).
 *
 * @param {number} quotaMensalKz
 * @param {string} isoDate — YYYY-MM-DD
 * @param {number[] | null | undefined} diasSemanaAcordo
 * @param {'ida'|'regresso'|'ambas'} [viagem='ambas']
 * @returns {number}
 */
export function computeFaltaDescontoForIsoDate(
  quotaMensalKz,
  isoDate,
  diasSemanaAcordo,
  viagem = 'ambas',
) {
  const iso = String(isoDate || '').slice(0, 10);
  const mesInicio = `${iso.slice(0, 7)}-01`;
  const dias = countDiasViagemMes(mesInicio, diasSemanaAcordo);
  return computeFaltaDesconto(quotaMensalKz, dias, viagem);
}
