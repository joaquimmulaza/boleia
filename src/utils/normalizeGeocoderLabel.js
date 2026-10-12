/**
 * Normaliza label de sugestão para deduplicação (case/acentos/espaços).
 * @param {string} label
 * @returns {string}
 */
export function normalizeGeocoderLabel(label) {
  return String(label || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
