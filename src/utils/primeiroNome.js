/**
 * Primeiro nome para UI (sem apelido).
 * @param {string | null | undefined} nomeCompleto
 * @returns {string}
 */
export function formatPrimeiroNome(nomeCompleto) {
  const trimmed = String(nomeCompleto || '').trim();
  if (!trimmed) return 'Passageiro';
  const [primeiro] = trimmed.split(/\s+/);
  return primeiro || 'Passageiro';
}
