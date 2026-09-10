// Caching the Intl.NumberFormat instance significantly improves performance
// compared to calling .toLocaleString() on every invocation.
const formatter = new Intl.NumberFormat('pt-PT');

/**
 * Formata valores monetários em Kwanza (Kz) com locale PT-PT.
 * @param {number|string} value
 * @returns {string}
 */
export function formatKwanza(value) {
  return formatter.format(Number(value));
}
