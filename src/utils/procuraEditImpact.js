import { evaluateMatch } from './matchingFilters.js';

/**
 * @param {object} oferta
 */
function toOfertaMatchInput(oferta) {
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
 */
function toProcuraMatchInput(procura) {
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

/**
 * Preview de impacto (cliente). A RPC continua a ser a fonte de verdade.
 * Teto não entra no matching.
 *
 * @param {{
 *   propostas?: Array<{ estado?: string, oferta_id?: string }>,
 *   ofertasById?: Record<string, object> | Map<string, object>,
 *   procura: object,
 *   nCandidato?: number,
 * }} args
 * @returns {number}
 */
export function countPropostasAInvalidar({
  propostas = [],
  ofertasById = {},
  procura,
  nCandidato = 1,
}) {
  const getOferta = (id) => {
    if (!id) return null;
    if (typeof ofertasById.get === 'function') return ofertasById.get(id) ?? null;
    return ofertasById[id] ?? null;
  };

  let n = 0;
  for (const prop of propostas || []) {
    if (String(prop?.estado || '').toLowerCase() !== 'aberta') continue;
    const oferta = getOferta(prop.oferta_id);
    if (!oferta) continue;
    const outcome = evaluateMatch({
      oferta: toOfertaMatchInput(oferta),
      procura: toProcuraMatchInput(procura),
      n_candidato: nCandidato,
    });
    if (outcome === 'incompatible') n += 1;
  }
  return n;
}
