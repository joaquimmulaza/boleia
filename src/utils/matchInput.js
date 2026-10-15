/**
 * @param {object} oferta
 * @returns {{
 *   departure_time: string,
 *   origin_lat: number | null,
 *   origin_lng: number | null,
 *   destination_lat: number | null,
 *   destination_lng: number | null,
 *   vagas_disponiveis: number,
 *   flexibilidade_rota: boolean,
 *   dias_semana: number[] | null,
 * }}
 */
export function toOfertaMatchInput(oferta) {
  const isFlex = Boolean(oferta?.flexibilidade_rota);
  return {
    departure_time: String(oferta.departure_time).slice(0, 5),
    origin_lat:
      oferta.origin_lat != null && oferta.origin_lat !== ''
        ? Number(oferta.origin_lat)
        : null,
    origin_lng:
      oferta.origin_lng != null && oferta.origin_lng !== ''
        ? Number(oferta.origin_lng)
        : null,
    destination_lat:
      oferta.destination_lat != null && oferta.destination_lat !== ''
        ? Number(oferta.destination_lat)
        : null,
    destination_lng:
      oferta.destination_lng != null && oferta.destination_lng !== ''
        ? Number(oferta.destination_lng)
        : null,
    vagas_disponiveis: oferta.vagas_disponiveis,
    flexibilidade_rota: isFlex,
    dias_semana: Array.isArray(oferta.dias_semana) ? oferta.dias_semana : null,
  };
}

/**
 * @param {object} procura
 * @returns {{
 *   preferred_time: string,
 *   origin_lat: number | null,
 *   origin_lng: number | null,
 *   destination_lat: number | null,
 *   destination_lng: number | null,
 *   dias_semana: number[] | null,
 * }}
 */
export function toProcuraMatchInput(procura) {
  return {
    preferred_time: String(procura.preferred_time).slice(0, 5),
    origin_lat:
      procura.origin_lat != null && procura.origin_lat !== ''
        ? Number(procura.origin_lat)
        : null,
    origin_lng:
      procura.origin_lng != null && procura.origin_lng !== ''
        ? Number(procura.origin_lng)
        : null,
    destination_lat:
      procura.destination_lat != null && procura.destination_lat !== ''
        ? Number(procura.destination_lat)
        : null,
    destination_lng:
      procura.destination_lng != null && procura.destination_lng !== ''
        ? Number(procura.destination_lng)
        : null,
    dias_semana: Array.isArray(procura.dias_semana) ? procura.dias_semana : null,
  };
}
