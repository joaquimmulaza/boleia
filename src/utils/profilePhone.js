/**
 * Parte local do telefone (9 dígitos) sem prefixo +244.
 * @param {string | null | undefined} telefone
 * @returns {string}
 */
export function stripAngolaPhoneLocal(telefone) {
  return String(telefone || '')
    .replace(/^\+244/, '')
    .replace(/[\s-]/g, '');
}

/**
 * Apresentação legível: +244 9XX XXX XXX
 * @param {string | null | undefined} telefone
 * @returns {string}
 */
export function formatAngolaPhoneDisplay(telefone) {
  const local = stripAngolaPhoneLocal(telefone);
  if (!local) return '';
  const chunks = local.match(/^(\d{3})(\d{3})(\d{3})$/) || [local];
  if (chunks.length >= 4) {
    return `+244 ${chunks[1]} ${chunks[2]} ${chunks[3]}`;
  }
  return `+244 ${local}`;
}

/**
 * @param {string} localDigits
 * @returns {string}
 */
export function buildAngolaPhoneE164(localDigits) {
  return `+244${String(localDigits).replace(/[\s-]/g, '')}`;
}
