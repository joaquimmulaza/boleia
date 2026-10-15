import { formatKwanza } from './formatKwanza.js';

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
 * @param {unknown} value
 * @returns {value is number}
 */
function isPresentKz(value) {
  return value !== null && value !== undefined && value !== '';
}

/**
 * Espelha COALESCE SQL (0 é valor válido).
 * @param {Array<unknown>} values
 * @returns {number}
 */
function coalesceKz(...values) {
  for (const value of values) {
    if (!isPresentKz(value)) continue;
    const n = Number(value);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
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
    return coalesceKz(
      pagamento.valor_pago_confirmado_kz,
      pagamento.valor_quota_original_kz,
      pagamento.valor_kz,
    );
  }
  if (estado === 'comprovativo_enviado') {
    return coalesceKz(pagamento.valor_kz);
  }
  return 0;
}

/**
 * @param {{ valor_devido_kz?: number | null } | null | undefined} pagamento
 * @returns {boolean}
 */
export function isValorDevidoKzKnown(pagamento) {
  if (!pagamento || !Object.prototype.hasOwnProperty.call(pagamento, 'valor_devido_kz')) {
    return false;
  }
  if (pagamento.valor_devido_kz == null) return false;
  return Number.isFinite(Number(pagamento.valor_devido_kz));
}

/**
 * `valor_devido_kz` na BD = quota proporcional devida (não é o reembolso).
 * Excesso a devolver = max(0, pago − devido) quando devido é conhecido; senão `null`.
 *
 * @param {{ estado?: string, valor_devido_kz?: number | null, valor_pago_confirmado_kz?: number | null, valor_quota_original_kz?: number | null, valor_kz?: number | null } | null | undefined} pagamento
 * @returns {number | null}
 */
export function computeExcessoReembolsoKz(pagamento) {
  if (!isValorDevidoKzKnown(pagamento)) return null;
  const pago = valorPagoEfectivoKz(pagamento);
  const devido = Number(pagamento.valor_devido_kz);
  return Math.max(0, pago - devido);
}

/**
 * @param {number | null} excessoKz
 * @returns {string}
 */
export function formatExcessoReembolsoPrincipal(excessoKz) {
  if (excessoKz === null) return '—';
  return `${formatKwanza(excessoKz)} Kz`;
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
