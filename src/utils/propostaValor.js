/**
 * @param {string | number} raw
 * @returns {number}
 */
export function parseValorPropostaKz(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (!digits) return NaN;
  return parseInt(digits, 10);
}

/**
 * @param {number} valor
 * @returns {{ ok: true, valor: number } | { ok: false, erro: string }}
 */
export function validarValorPropostaKz(valor) {
  if (!Number.isInteger(valor) || valor <= 0) {
    return { ok: false, erro: 'Indica um valor mensal maior que zero (Kz).' };
  }
  return { ok: true, valor };
}

/**
 * @param {'POR_PASSAGEIRO' | 'TOTAL_ACORDO' | string | undefined} modoPreco
 * @returns {string}
 */
export function labelValorProposta(modoPreco) {
  return modoPreco === 'TOTAL_ACORDO'
    ? 'Valor total do acordo na proposta (Kz)'
    : 'Valor por passageiro na proposta (Kz)';
}
