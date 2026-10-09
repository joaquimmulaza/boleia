/**
 * Aceites `accept_proposal` pendentes na fila offline (IndexedDB).
 */

/** @typedef {{ rpc?: string, args?: { p_proposta_id?: string } }} PendingQueueItem */

/**
 * @param {PendingQueueItem | null | undefined} item
 * @returns {string}
 */
export function propostaIdFromAcceptQueueItem(item) {
  const id = item?.args?.p_proposta_id;
  return id != null ? String(id) : '';
}

/**
 * @param {PendingQueueItem[]} [pending]
 * @returns {Set<string>}
 */
export function collectPendingAcceptPropostaIds(pending) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const item of pending || []) {
    if (item?.rpc !== 'accept_proposal') continue;
    const pid = propostaIdFromAcceptQueueItem(item);
    if (pid) ids.add(pid);
  }
  return ids;
}

export const COPY_ERRO_ACEITE_OFERTA_MUDOU = 'Não foi possível aceitar — a oferta mudou.';
export const COPY_ERRO_ACEITE_GENERICO = 'Não foi possível aceitar. Tenta outra vez.';

/**
 * @param {unknown} err
 * @returns {boolean}
 */
const ERRO_ACEITE_OFERTA_MUDOU =
  /Proposta não está aberta|Proposta não encontrada|Oferta não encontrada|Vagas insuficientes|Capacidade inconsistente|Sem vagas|já não está aberta|proposta invalida|invalidada/i;

export function isErroAceiteOfertaInvalida(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (!msg.trim()) return false;
  if (/sessão necessária/i.test(msg)) return false;
  if (/Só a contraparte pode aceitar/i.test(msg)) return false;
  return ERRO_ACEITE_OFERTA_MUDOU.test(msg);
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function mensagemErroAceiteInbox(err) {
  const msg = err instanceof Error ? err.message : String(err || '');
  if (msg.includes('Sessão necessária')) {
    return msg;
  }
  if (isErroAceiteOfertaInvalida(err)) {
    return COPY_ERRO_ACEITE_OFERTA_MUDOU;
  }
  return COPY_ERRO_ACEITE_GENERICO;
}
