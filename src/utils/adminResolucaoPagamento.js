/** Toast após copiar UUID do acordo (FeedbackAlert). */
export const TOAST_ID_ACORDO_COPIADO = 'ID copiado.';

/**
 * Copy aprovada (PM + Critiquito).
 * @type {{ excessoReembolso: string, excessoReembolsoCurto: string, quotaPaga: string, idAcordo: string, copiarIdAcordoAria: string }}
 */
export const ADMIN_RESOLUCAO_COPY = {
  excessoReembolso: 'A devolver ao passageiro',
  excessoReembolsoCurto: 'A devolver',
  quotaPaga: 'Quota paga',
  idAcordo: 'ID do acordo',
  copiarIdAcordoAria: 'Copiar ID do acordo',
};

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function copyTextToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

/**
 * Espelha `public._valor_pago_efectivo_kz` (estados relevantes para resolução admin).
 * @param {{ estado?: string, valor_pago_confirmado_kz?: number | null, valor_quota_original_kz?: number | null, valor_kz?: number | null } | null | undefined} pagamento
 * @returns {number}
 */
export function valorPagoEfectivoKz(pagamento) {
  if (!pagamento) return 0;
  const estado = String(pagamento.estado || '').toLowerCase();
  if (estado === 'em_custodia' || estado === 'liquidado') {
    const confirmado = Number(pagamento.valor_pago_confirmado_kz);
    if (Number.isFinite(confirmado) && confirmado > 0) return confirmado;
    const quotaOrig = Number(pagamento.valor_quota_original_kz);
    if (Number.isFinite(quotaOrig) && quotaOrig > 0) return quotaOrig;
    const valor = Number(pagamento.valor_kz);
    return Number.isFinite(valor) ? Math.max(0, valor) : 0;
  }
  if (estado === 'comprovativo_enviado') {
    const valor = Number(pagamento.valor_kz);
    return Number.isFinite(valor) ? Math.max(0, valor) : 0;
  }
  return 0;
}

/**
 * `valor_devido_kz` na BD = quota proporcional devida (não é o reembolso).
 * Excesso a devolver ao passageiro = max(0, pago − devido).
 *
 * @param {{ estado?: string, valor_devido_kz?: number | null, valor_pago_confirmado_kz?: number | null, valor_quota_original_kz?: number | null, valor_kz?: number | null } | null | undefined} pagamento
 * @returns {number}
 */
export function computeExcessoReembolsoKz(pagamento) {
  if (!pagamento) return 0;
  const pago = valorPagoEfectivoKz(pagamento);
  const devidoRaw = pagamento.valor_devido_kz;
  const devido = Number(devidoRaw);
  if (!Number.isFinite(devido)) {
    return 0;
  }
  return Math.max(0, pago - devido);
}

/**
 * @param {string | null | undefined} acordoId
 * @returns {string | null}
 */
export function formatAcordoIdCurto(acordoId) {
  if (!acordoId || typeof acordoId !== 'string') return null;
  const trimmed = acordoId.trim();
  if (trimmed.length < 8) return trimmed;
  return trimmed.slice(0, 8);
}
