import { DIAS_UTEIS_DEFAULT } from './diasSemana.js';
import { MODOS_PRECO } from './modosPreco.js';

/**
 * Gaps do sheet «Enviar proposta» quando o motorista ainda não tem oferta.
 * @param {{ valor_mensal_ask_kz?: number | string | null } | null | undefined} ofertaOuDraft
 * @returns {Array<'valor'>}
 */
export function getPropostaDriverGaps(ofertaOuDraft) {
  const ask = Number(ofertaOuDraft?.valor_mensal_ask_kz);
  if (!Number.isInteger(ask) || ask <= 0) {
    return ['valor'];
  }
  return [];
}

/**
 * Constrói payload mínimo de oferta flexível a partir de uma procura (browse → propor).
 * Sempre flexível (OD null) — não inventa rota fixa a partir da procura.
 *
 * @param {object} procura
 * @param {{
 *   modo_preco: string,
 *   valor_mensal_ask_kz: number,
 *   departure_time?: string,
 *   return_time?: string | null,
 *   dias_semana?: number[] | null,
 * }} overrides
 * @returns {{
 *   flexibilidade_rota: true,
 *   origin_name: null,
 *   origin_lat: null,
 *   origin_lng: null,
 *   destination_name: null,
 *   destination_lat: null,
 *   destination_lng: null,
 *   departure_time: string,
 *   return_time: string | null,
 *   dias_semana: number[],
 *   modo_preco: string,
 *   valor_mensal_ask_kz: number,
 * }}
 */
export function buildOfertaMinimaFromProcura(procura, overrides) {
  if (!MODOS_PRECO.has(overrides?.modo_preco)) {
    throw new Error('Modo de preço inválido.');
  }

  const ask = Number(overrides.valor_mensal_ask_kz);
  if (!Number.isInteger(ask) || ask <= 0) {
    throw new Error('Valor mensal em Kz inválido.');
  }

  const departureTime = String(
    overrides.departure_time ?? procura?.preferred_time ?? '',
  ).slice(0, 5);

  if (!departureTime) {
    throw new Error('Horário é obrigatório para enviar proposta.');
  }

  const returnRaw = overrides.return_time ?? procura?.return_time ?? null;
  const returnTime = returnRaw ? String(returnRaw).slice(0, 5) : null;

  const diasSemana =
    Array.isArray(overrides.dias_semana) && overrides.dias_semana.length > 0
      ? overrides.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
      : Array.isArray(procura?.dias_semana) && procura.dias_semana.length > 0
        ? procura.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
        : [...DIAS_UTEIS_DEFAULT];

  return {
    flexibilidade_rota: true,
    origin_name: null,
    origin_lat: null,
    origin_lng: null,
    destination_name: null,
    destination_lat: null,
    destination_lng: null,
    departure_time: departureTime,
    return_time: returnTime,
    dias_semana: diasSemana,
    modo_preco: overrides.modo_preco,
    valor_mensal_ask_kz: ask,
  };
}
