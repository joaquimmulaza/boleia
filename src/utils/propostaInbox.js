import { isPropostaHistorico } from './propostaEstado';

/**
 * Helpers de inbox de propostas (sentidos A e B).
 *
 * - Inbox da contraparte: propostas abertas que o utilizador pode aceitar/recusar
 *   (`created_by !== userId`).
 * - Enviadas pelo criador: abertas que o criador pode cancelar
 *   (`created_by === userId`).
 * - Historico: rejeitada / cancelada / aceite visíveis nos hubs (acções só em aberta).
 */
/**
 * Filtra propostas abertas que a contraparte pode aceitar/recusar
 * (exclui as criadas pelo próprio utilizador — sentidos A e B).
 *
 * @param {Array<{ estado?: string, created_by?: string }>|null|undefined} propostas
 * @param {string} userId
 * @returns {object[]}
 */
export function filterPropostasParaInbox(propostas, userId) {
  if (!userId) return [];
  const list = Array.isArray(propostas) ? propostas : [];
  return list.filter((p) => p?.estado === 'aberta' && p.created_by !== userId);
}

/**
 * Filtra propostas abertas enviadas pelo próprio utilizador (canceláveis).
 *
 * @param {Array<{ estado?: string, created_by?: string }>|null|undefined} propostas
 * @param {string} userId
 * @returns {object[]}
 */
export function filterPropostasEnviadas(propostas, userId) {
  if (!userId) return [];
  const list = Array.isArray(propostas) ? propostas : [];
  return list.filter((p) => p?.estado === 'aberta' && p.created_by === userId);
}

/**
 * Propostas recebidas no historico (rejeitada/cancelada/aceite — criadas por outro).
 *
 * @param {Array<{ estado?: string, created_by?: string }>|null|undefined} propostas
 * @param {string} userId
 * @returns {object[]}
 */
export function filterPropostasTerminadasRecebidas(propostas, userId) {
  if (!userId) return [];
  const list = Array.isArray(propostas) ? propostas : [];
  return list.filter(
    (p) => p?.created_by !== userId && isPropostaHistorico(p?.estado),
  );
}

/**
 * Propostas enviadas no historico (recusadas/canceladas/aceites pelo fluxo normal).
 *
 * @param {Array<{ estado?: string, created_by?: string }>|null|undefined} propostas
 * @param {string} userId
 * @returns {object[]}
 */
export function filterPropostasTerminadasEnviadas(propostas, userId) {
  if (!userId) return [];
  const list = Array.isArray(propostas) ? propostas : [];
  return list.filter(
    (p) => p?.created_by === userId && isPropostaHistorico(p?.estado),
  );
}

/**
 * Resolve o inbox da contraparte para deep link / metadata.inbox.
 * Sentido A (criador = owner procura) → 'motorista'.
 * Sentido B (criador = driver) → 'passageiro'.
 *
 * @param {{
 *   createdBy?: string | null,
 *   driverId?: string | null,
 *   ownerId?: string | null,
 * }} params
 * @returns {'passageiro' | 'motorista' | null}
 */
export function resolvePropostaInbox({ createdBy, driverId, ownerId } = {}) {
  if (!createdBy || !driverId || !ownerId) return null;
  if (createdBy === driverId) return 'passageiro';
  if (createdBy === ownerId) return 'motorista';
  return null;
}
