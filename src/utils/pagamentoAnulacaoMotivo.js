import {
  ANULACAO_MOTIVO,
  ANULACAO_MOTIVOS_EXPIRACAO_RESERVA,
} from '../constants/anulacaoMotivos.js';

/** Motivos de saída voluntária / rescisão antes da activação → chip «Saiu» e UI S3. */
export const ANULACAO_MOTIVOS_SAIDA_VOLUNTARIA = Object.freeze([
  ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
  ANULACAO_MOTIVO.ACORDO_TERMINADO_ANTES_ACTIVACAO,
]);

/**
 * @param {{ anulacao_motivo?: string | null } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isAnulacaoMotivoSaidaVoluntaria(pagamento) {
  const motivo = String(pagamento?.anulacao_motivo ?? '').trim();
  return ANULACAO_MOTIVOS_SAIDA_VOLUNTARIA.includes(motivo);
}

/**
 * @param {{ anulacao_motivo?: string | null } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isAnulacaoPorSaidaAntesActivacao(pagamento) {
  return isAnulacaoMotivoSaidaVoluntaria(pagamento);
}

/**
 * S1 (expiração TTL / reserva terminada) — matching exacto ou legacy vazio.
 * Qualquer outro texto (incl. desconhecido) → false (UI S3).
 *
 * @param {{ anulacao_motivo?: string | null } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isAnulacaoReservaExpiradaPorPagamento(pagamento) {
  const raw = pagamento?.anulacao_motivo;
  if (raw == null || String(raw).trim() === '') {
    return true;
  }
  const motivo = String(raw).trim();
  return ANULACAO_MOTIVOS_EXPIRACAO_RESERVA.includes(motivo);
}
