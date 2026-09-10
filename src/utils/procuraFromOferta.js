import { DIAS_UTEIS_DEFAULT } from './diasSemana.js';

/**
 * Campos em falta para propor a partir do browse (antes de criar procura mínima).
 * Flexível: nunca pede OD. Fixa: OD com coordenadas + horário.
 *
 * @param {{
 *   flexibilidade_rota?: boolean,
 *   origin_name?: string | null,
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_name?: string | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 *   departure_time?: string | null,
 * }} oferta
 * @returns {Array<'time' | 'od'>}
 */
export function getPropostaBrowseGaps(oferta) {
  const gaps = [];
  const time = String(oferta?.departure_time ?? '').trim();
  if (!time) {
    gaps.push('time');
  }

  if (!oferta?.flexibilidade_rota) {
    const hasOd =
      oferta?.origin_name &&
      oferta.origin_lat != null &&
      oferta.origin_lng != null &&
      oferta?.destination_name &&
      oferta.destination_lat != null &&
      oferta.destination_lng != null;
    if (!hasOd) {
      gaps.push('od');
    }
  }

  return gaps;
}

/**
 * @param {{
 *   preferred_time?: string,
 *   origin_name?: string | null,
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_name?: string | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 *   dias_semana?: number[] | null,
 * }} overrides
 * @param {object} oferta
 */
function resolveProcuraFields(oferta, overrides = {}) {
  const preferredTime = String(
    overrides.preferred_time ?? oferta?.departure_time ?? '',
  ).slice(0, 5);

  if (!preferredTime) {
    throw new Error('Horário é obrigatório para propor acordo.');
  }

  const diasSemana = Array.isArray(overrides.dias_semana) && overrides.dias_semana.length > 0
    ? overrides.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
    : Array.isArray(oferta?.dias_semana) && oferta.dias_semana.length > 0
      ? oferta.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
      : [...DIAS_UTEIS_DEFAULT];

  return { preferredTime, diasSemana };
}

/**
 * Constrói payload mínimo de procura a partir de uma oferta (browse → propor acordo).
 * Flexível: OD null (nunca inventada). Fixa: exige coordenadas (oferta ou overrides do sheet).
 *
 * @param {object} oferta
 * @param {{
 *   preferred_time?: string,
 *   origin_name?: string | null,
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_name?: string | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 *   dias_semana?: number[] | null,
 * }} [overrides]
 * @returns {{
 *   preferred_time: string,
 *   origin_name: string | null,
 *   origin_lat: number | null,
 *   origin_lng: number | null,
 *   destination_name: string | null,
 *   destination_lat: number | null,
 *   destination_lng: number | null,
 *   dias_semana: number[],
 *   teto_mensal_kz: null,
 * }}
 */
export function buildProcuraMinimaFromOferta(oferta, overrides = {}) {
  const { preferredTime, diasSemana } = resolveProcuraFields(oferta, overrides);

  if (oferta?.flexibilidade_rota) {
    return {
      preferred_time: preferredTime,
      origin_name: null,
      origin_lat: null,
      origin_lng: null,
      destination_name: null,
      destination_lat: null,
      destination_lng: null,
      dias_semana: diasSemana,
      teto_mensal_kz: null,
    };
  }

  const originName = overrides.origin_name ?? oferta?.origin_name ?? null;
  const originLat = overrides.origin_lat ?? oferta?.origin_lat ?? null;
  const originLng = overrides.origin_lng ?? oferta?.origin_lng ?? null;
  const destinationName = overrides.destination_name ?? oferta?.destination_name ?? null;
  const destinationLat = overrides.destination_lat ?? oferta?.destination_lat ?? null;
  const destinationLng = overrides.destination_lng ?? oferta?.destination_lng ?? null;

  const hasOd =
    originName &&
    originLat != null &&
    originLng != null &&
    destinationName &&
    destinationLat != null &&
    destinationLng != null;

  if (!hasOd) {
    throw new Error('Oferta fixa exige origem e destino com coordenadas.');
  }

  return {
    preferred_time: preferredTime,
    origin_name: originName,
    origin_lat: originLat,
    origin_lng: originLng,
    destination_name: destinationName,
    destination_lat: destinationLat,
    destination_lng: destinationLng,
    dias_semana: diasSemana,
    teto_mensal_kz: null,
  };
}
