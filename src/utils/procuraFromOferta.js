import { DIAS_UTEIS_DEFAULT } from './diasSemana.js';

/**
 * Constrói payload mínimo de procura a partir de uma oferta (browse → propor acordo).
 * Flexível: OD null (nunca inventada). Fixa: exige coordenadas da oferta.
 *
 * @param {{
 *   flexibilidade_rota?: boolean,
 *   origin_name?: string | null,
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_name?: string | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 *   departure_time?: string,
 *   dias_semana?: number[] | null,
 * }} oferta
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
export function buildProcuraMinimaFromOferta(oferta) {
  const preferredTime = String(oferta?.departure_time || '07:15').slice(0, 5);
  const diasSemana = Array.isArray(oferta?.dias_semana) && oferta.dias_semana.length > 0
    ? oferta.dias_semana.map((d) => Number(d)).filter((d) => Number.isFinite(d))
    : [...DIAS_UTEIS_DEFAULT];

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

  const hasOd =
    oferta?.origin_name &&
    oferta.origin_lat != null &&
    oferta.origin_lng != null &&
    oferta?.destination_name &&
    oferta.destination_lat != null &&
    oferta.destination_lng != null;

  if (!hasOd) {
    throw new Error('Oferta fixa exige origem e destino com coordenadas.');
  }

  return {
    preferred_time: preferredTime,
    origin_name: oferta.origin_name,
    origin_lat: oferta.origin_lat,
    origin_lng: oferta.origin_lng,
    destination_name: oferta.destination_name,
    destination_lat: oferta.destination_lat,
    destination_lng: oferta.destination_lng,
    dias_semana: diasSemana,
    teto_mensal_kz: null,
  };
}
