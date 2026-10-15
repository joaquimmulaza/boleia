import { resolveMotivoFimLugar } from './acordoSeatEndChip.js';
import { isLugarVivoPassageiro } from './estadoPassageiro.js';
import { PAYMENT_STATES } from './paymentStatus.js';

/** Copy linha quota — lugar expirado com pagamento anulado. */
export const QUOTA_LINHA_ANULADO = '0 Kz · anulado';

/**
 * @typedef {{ kind: 'quota', kz: number | null | undefined }} QuotaLinhaQuota
 * @typedef {{ kind: 'text', text: string }} QuotaLinhaText
 * @typedef {{ kind: 'hidden' }} QuotaLinhaHidden
 * @typedef {QuotaLinhaQuota | QuotaLinhaText | QuotaLinhaHidden} QuotaLinhaPassageiroUi
 */

/**
 * Quota na linha de passageiro (detalhe motorista) — reserva expirada não mostra quota congelada.
 *
 * @param {{ estado?: string | null, quota_mensal_kz?: number | null }} linha
 * @param {{ estado?: string | null, anulacao_motivo?: string | null } | null | undefined} pagamentoChipCtx
 * @returns {QuotaLinhaPassageiroUi}
 */
export function resolveQuotaLinhaPassageiroUi(linha, pagamentoChipCtx) {
  if (isLugarVivoPassageiro(linha?.estado)) {
    return { kind: 'quota', kz: linha?.quota_mensal_kz };
  }
  if (resolveMotivoFimLugar(linha, pagamentoChipCtx) === 'reserva_expirada') {
    const e = String(pagamentoChipCtx?.estado || '').toLowerCase();
    if (e === PAYMENT_STATES.ANULADO) {
      return { kind: 'text', text: QUOTA_LINHA_ANULADO };
    }
    return { kind: 'hidden' };
  }
  return { kind: 'quota', kz: linha?.quota_mensal_kz };
}
