/**
 * Desconto de falta por dia útil (MKT-07 / G9) — política meia quota.
 * Alinhado a SQL `handle_falta_desconto`:
 * - `ambas` → ROUND(quota / dias, 2)
 * - `ida` | `regresso` → ROUND(quota / dias / 2, 2)
 *
 * @param {number} quotaMensalKz Quota mensal do passageiro (Kz)
 * @param {number} diasUteisMes Dias úteis do mês no acordo
 * @param {'ida'|'regresso'|'ambas'} [viagem='ambas']
 * @returns {number} Desconto em Kz com 2 casas decimais
 */
export function computeFaltaDesconto(quotaMensalKz, diasUteisMes, viagem = 'ambas') {
  const quota = Number(quotaMensalKz);
  const dias = Number(diasUteisMes);
  if (!Number.isFinite(quota) || !Number.isFinite(dias) || dias === 0) {
    throw new Error('Quota e dias úteis devem ser números válidos (dias ≠ 0).');
  }
  const v = String(viagem || 'ambas').toLowerCase();
  if (v !== 'ida' && v !== 'regresso' && v !== 'ambas') {
    throw new Error('Viagem inválida. Use ida, regresso ou ambas.');
  }
  const diaInteiro = Math.round((quota / dias) * 100) / 100;
  if (v === 'ambas') return diaInteiro;
  return Math.round((quota / dias / 2) * 100) / 100;
}
