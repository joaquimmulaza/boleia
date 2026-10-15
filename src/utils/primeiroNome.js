/**
 * Primeiro nome para UI (sem apelido).
 * @param {string | null | undefined} nomeCompleto
 * @returns {string}
 */
export function formatPrimeiroNome(nomeCompleto) {
  const parts = String(nomeCompleto || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'Passageiro';
  if (parts.length >= 2 && /^qa$/i.test(parts[0])) {
    return parts[1];
  }
  return parts[0];
}
