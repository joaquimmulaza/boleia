import {
  FALTA_DATA_INLINE_ERRO_DIA,
  FALTA_SERVIDOR_ERRO_DIA,
} from '../copy/faltasLogAbsenceCopy.js';

/** SQLSTATE dedicado: prazo passageiro (22:00 Luanda véspera) — só log_falta tipo Passageiro. */
export const LOG_FALTA_SQLSTATE_PRAZO_PASSAGEIRO = 'BCF02';

/** SQLSTATE dedicado: data fora dos dias de viagem do acordo (oferta.dias_semana). */
export const LOG_FALTA_SQLSTATE_DIA_VIAGEM = 'BCF03';

export const LOG_FALTA_MSG_PRAZO_PASSAGEIRO =
  'Já não é possível registar esta falta. Só podes avisar até às 22:00 do dia anterior.';

export const LOG_FALTA_MSG_DIA_VIAGEM_INLINE = FALTA_DATA_INLINE_ERRO_DIA;

export const LOG_FALTA_MSG_DIA_VIAGEM_SERVIDOR = FALTA_SERVIDOR_ERRO_DIA;

/**
 * Mapeia erros do RPC `log_falta` para copy inline (modal). Devolve null se não mapeado.
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
  if (code === LOG_FALTA_SQLSTATE_DIA_VIAGEM) {
    return LOG_FALTA_MSG_DIA_VIAGEM_INLINE;
  }

  return null;
}

/**
 * Toast / banner após falha no servidor (AbsenceTracker).
 * @param {unknown} error
 * @returns {string | null}
 */
export function mapLogFaltaErrorToast(error) {
  if (!error || typeof error !== 'object') {
    return null;
  }
  const code = /** @type {{ code?: string }} */ (error).code;
  if (code === LOG_FALTA_SQLSTATE_DIA_VIAGEM) {
    return LOG_FALTA_MSG_DIA_VIAGEM_SERVIDOR;
  }
  return null;
}
