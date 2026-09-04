/**
 * Formata valores monetários em Kwanza (Kz) com locale PT-PT.
 * @param {number|string} value
 * @returns {string}
 */
export function formatKwanza(value) {
  return Number(value).toLocaleString('pt-PT');
}
