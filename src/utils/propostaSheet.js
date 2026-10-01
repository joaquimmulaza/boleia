import { formatKwanza } from './formatKwanza.js';
import { isPropostaAberta } from './propostaEstado.js';

/**
 * Abrevia nome para linha da sheet («Maria Silva» → «Maria S.»).
 * @param {string | null | undefined} nome
 * @returns {string}
 */
export function abbrevNome(nome) {
  const raw = String(nome || 'Passageiro').trim();
  if (!raw) return 'Passageiro';
  const parts = raw.split(/\s+/);
  if (parts.length <= 1) return parts[0];
  const ultimo = parts[parts.length - 1];
  return `${parts[0]} ${ultimo.charAt(0).toUpperCase()}.`;
}

/**
 * Label da row na ProposalSheet (Figma: «Maria S. · 1 pax»).
 * @param {{ titulo?: string, membros?: Array<{ nome?: string }>, proposta?: { n_passageiros_propostos?: number } }} review
 * @returns {string}
 */
export function labelPropostaSheetRow(review) {
  const n = Number(review?.proposta?.n_passageiros_propostos) || review?.membros?.length || 1;
  const primeiro = review?.membros?.[0]?.nome;
  if (primeiro) {
    return `${abbrevNome(primeiro)} · ${n} pax`;
  }
  if (review?.titulo) return review.titulo;
  return n === 1 ? '1 pax' : `${n} pax`;
}

/**
 * @param {number} n
 * @param {string} singular
 * @param {string} plural
 */
function countPart(n, singular, plural) {
  return n === 1 ? `1 ${singular}` : `${n} ${plural}`;
}

/**
 * Resumo no header da sheet («Oferta flexível · 07:15 · 2 propostas recebidas»).
 * @param {{
 *   tituloOferta: string,
 *   horario: string,
 *   count: number,
 *   recebidas?: number,
 *   enviadas?: number,
 *   concluidas?: number,
 * }} opts
 * @returns {string}
 */
export function buildPropostasSheetSummary({
  tituloOferta,
  horario,
  count,
  recebidas,
  enviadas = 0,
  concluidas = 0,
}) {
  const prefix = `${tituloOferta} · ${horario}`;
  if (count === 0) {
    return `${prefix} · 0 propostas`;
  }

  const recebidasCount = recebidas ?? (enviadas === 0 && concluidas === 0 ? count : 0);

  const mixed = enviadas > 0 || concluidas > 0;
  if (mixed) {
    const parts = [
      recebidasCount > 0 ? countPart(recebidasCount, 'recebida', 'recebidas') : null,
      enviadas > 0 ? countPart(enviadas, 'enviada', 'enviadas') : null,
      concluidas > 0 ? countPart(concluidas, 'concluída', 'concluídas') : null,
    ].filter(Boolean);
    if (parts.length > 0) {
      return `${prefix} · ${parts.join(' · ')}`;
    }
  }

  if (recebidasCount === count && count > 0) {
    const nLabel = count === 1 ? '1 proposta recebida' : `${count} propostas recebidas`;
    return `${prefix} · ${nLabel}`;
  }

  return `${prefix} · ${count === 1 ? '1 proposta' : `${count} propostas`}`;
}

/**
 * Preço formatado para row da sheet.
 * @param {{ proposta?: { valor_mensal_ask_kz?: number }, pricing?: { valor_mensal_por_passageiro_kz?: number } }} review
 * @returns {string}
 */
export function formatPropostaSheetPreco(review) {
  const ask = Number(review?.proposta?.valor_mensal_ask_kz);
  const porPax = Number(review?.pricing?.valor_mensal_por_passageiro_kz);
  const kz = Number.isFinite(ask) && ask > 0 ? ask : (Number.isFinite(porPax) ? porPax : 0);
  return `${formatKwanza(kz)} Kz`;
}

/**
 * Badge «Pendente» para propostas abertas na sheet (Figma C2).
 * @param {string | null | undefined} estado
 * @returns {{ label: string, className: string } | null}
 */
export function chipPropostaSheet(estado) {
  if (!isPropostaAberta(estado)) return null;
  return {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300',
  };
}
