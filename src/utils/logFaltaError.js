/** SQLSTATE dedicado: prazo passageiro (22:00 Luanda véspera) — só log_falta tipo Passageiro. */
export const LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO = 'BCF02';

export const LOG_FALTA_MSG_PRAZO_PASSAGEIRO =
  'Já não é possível registar esta falta. Só podes avisar até às 22:00 do dia anterior.';

/**
 * Mapeia erros do RPC `log_falta`. Devolve null se o erro não for mapeado aqui.
 * @param {unknown} error
 * @returns {string | null}
 */
export function mapLogFaltaError(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }

  const code = /** @type {{ code?: string }} */ (error).code;
  if (code === LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO) {
    return LOG_FALTA_MSG_PRAZO_PASSAGEIRO;
  }

  return null;
}
