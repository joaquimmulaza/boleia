import { formatPrimeiroNome } from './primeiroNome.js';

/**
 * @param {{ perfis?: { nome_completo?: string }, nome?: string }} pax
 * @returns {string}
 */
export function nomePassageiroFromLinha(pax) {
  return pax?.perfis?.nome_completo || pax?.nome || 'Passageiro';
}

/**
 * Nome na UI — motorista vê primeiro nome (QA prefix ignorado); passageiro vê nome completo.
 *
 * @param {{ perfis?: { nome_completo?: string }, nome?: string }} pax
 * @param {{ motorista?: boolean }} [opts]
 * @returns {string}
 */
export function nomePassageiroUi(pax, { motorista = false } = {}) {
  const nome = nomePassageiroFromLinha(pax);
  return motorista ? formatPrimeiroNome(nome) : nome;
}

/**
 * Iniciais do avatar a partir do nome já resolvido para UI.
 *
 * @param {string | null | undefined} nome
 * @returns {string}
 */
export function iniciaisPassageiroUi(nome) {
  const parts = String(nome || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
