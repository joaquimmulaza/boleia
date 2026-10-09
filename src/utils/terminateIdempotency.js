import { v5 as uuidv5 } from 'uuid';

/** Namespace fixo Boleia — chaves estáveis por acordo (confirmação consensual). */
const BOLEIA_IDEMPOTENCY_NS = 'a3f2c8e1-4b9d-4e2a-9f1c-8d7e6b5a4c3b';

/**
 * Chave estável para repetir «Confirmar» encerramento consensual (idempotência RPC).
 * @param {string} acordoId
 * @returns {string}
 */
export function terminateConfirmIdempotencyKey(acordoId) {
  if (!acordoId) {
    throw new Error('ID do acordo é obrigatório.');
  }
  return uuidv5(`terminate_confirm:${acordoId}`, BOLEIA_IDEMPOTENCY_NS);
}
