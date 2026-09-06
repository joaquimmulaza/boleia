import { canAcceptDirectly } from './matchingFilters.js';

/**
 * Verdadeiro quando N_proposto/N_actual excede vagas — fluxo waitlist, não acordo directo.
 * @param {number} nProposto
 * @param {number} vagasDisponiveis
 * @returns {boolean}
 */
export function requiresWaitlist(nProposto, vagasDisponiveis) {
  const n = Number(nProposto);
  const vagas = Number(vagasDisponiveis);
  if (!Number.isFinite(n) || n < 1) return true;
  if (!Number.isFinite(vagas) || vagas < 0) return true;
  return !canAcceptDirectly(n, vagas);
}

/**
 * N para gate de capacidade: membros activos do grupo ou n_candidato da procura.
 * @param {{ n_candidato?: number | null, membrosActivos?: number | null }} input
 * @returns {number}
 */
export function resolveCapacityN(input) {
  const membros = Number(input?.membrosActivos);
  if (Number.isFinite(membros) && membros > 0) {
    return membros;
  }
  const n = Number(input?.n_candidato);
  if (Number.isFinite(n) && n >= 1) {
    return n;
  }
  return 1;
}
