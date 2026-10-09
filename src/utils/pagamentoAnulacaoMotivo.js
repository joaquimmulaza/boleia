/**
 * Motivos de anulação de pagamento (espelha copy da BD / RPC P0).
 * Usado para distinguir S1 (TTL) vs S3 (saída antes da activação).
 *
 * @param {{ anulacao_motivo?: string | null } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isAnulacaoPorSaidaAntesActivacao(pagamento) {
  const motivo = String(pagamento?.anulacao_motivo || '').trim().toLowerCase();
  if (!motivo) return false;
  return motivo.includes('saíste antes') || motivo.includes('saiste antes');
}

/**
 * Reserva expirou por falta de pagamento no prazo (não saída voluntária).
 *
 * @param {{ anulacao_motivo?: string | null } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isAnulacaoReservaExpiradaPorPagamento(pagamento) {
  const motivo = String(pagamento?.anulacao_motivo || '').trim().toLowerCase();
  if (!motivo) return true;
  if (isAnulacaoPorSaidaAntesActivacao(pagamento)) return false;
  if (motivo.includes('acordo terminado antes')) return false;
  return (
    motivo.includes('reserva terminada')
    || motivo.includes('expirou')
    || motivo.includes('falta de pagamento')
  );
}
