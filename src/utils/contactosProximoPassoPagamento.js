import { PAYMENT_STATES } from './paymentStatus';

/**
 * Hint «Próximo passo: envia o comprovativo…» (contactos bloqueados, passageiro).
 * Só quando o lugar está reservado e ainda não há comprovativo (pendente_pagamento).
 *
 * @param {boolean} lugarReservado
 * @param {string | null | undefined} estadoPagamento
 * @returns {boolean}
 */
export function mostrarProximoPassoComprovativoPassageiro(lugarReservado, estadoPagamento) {
  if (!lugarReservado) return false;
  const e = String(estadoPagamento || '').toLowerCase();
  return e === PAYMENT_STATES.PENDENTE;
}

/**
 * Lógica anterior à correcção QA (só `reservado`) — usada em testes de regressão.
 * @param {boolean} lugarReservado
 * @returns {boolean}
 */
export function mostrarProximoPassoComprovativoPassageiroLegado(lugarReservado) {
  return Boolean(lugarReservado);
}
