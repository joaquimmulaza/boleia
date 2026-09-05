/**
 * Desconto de falta por dia útil (MKT-07 / G9).
 * Alinhado a SQL `ROUND(quota / dias_uteis, 2)` — não é adenda pro-rata.
 *
 * @param {number} quotaMensalKz Quota mensal do passageiro (Kz)
 * @param {number} diasUteisMes Dias úteis do mês no acordo
 * @returns {number} Desconto em Kz com 2 casas decimais
 */
export function computeFaltaDesconto(quotaMensalKz, diasUteisMes) {
  const quota = Number(quotaMensalKz);
  const dias = Number(diasUteisMes);
  if (!Number.isFinite(quota) || !Number.isFinite(dias) || dias === 0) {
    throw new Error('Quota e dias úteis devem ser números válidos (dias ≠ 0).');
  }
  return Math.round((quota / dias) * 100) / 100;
}
