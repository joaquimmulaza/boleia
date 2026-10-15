/**
 * Chave estável para recarregar o detalhe sem reagir a refreshes silenciosos do objecto `selected`.
 * @param {{ id?: string, estado?: string } | null | undefined} acordo
 * @returns {string | null}
 */
export function buildAcordoDetalheSyncKey(acordo) {
  if (!acordo?.id) return null;
  return `${acordo.id}:${String(acordo.estado || '').toLowerCase()}`;
}
