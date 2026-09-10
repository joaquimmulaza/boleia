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
 * Preview de impacto ao editar oferta (cliente). RPC é fonte de verdade.
 *
 * @param {{
 *   propostas?: Array<{ estado?: string, procura_id?: string, n_passageiros_propostos?: number }>,
 *   procurasById?: Record<string, object> | Map<string, object>,
 *   oferta: object,
 * }} args
 * @returns {number}
 */
export function countPropostasAInvalidarPorOferta({
  propostas = [],
  procurasById = {},
  oferta,
}) {
  const getProcura = (id) => {
    if (!id) return null;
    if (typeof procurasById.get === 'function') return procurasById.get(id) ?? null;
    return procurasById[id] ?? null;
  };

  let n = 0;
  for (const prop of propostas || []) {
    if (String(prop?.estado || '').toLowerCase() !== 'aberta') continue;
    const procura = getProcura(prop.procura_id);
    if (!procura) continue;
    const nCand = prop.n_passageiros_propostos ?? procura.n_candidato ?? 1;
    const outcome = evaluateMatch({
      oferta: toOfertaMatchInput(oferta),
      procura: toProcuraMatchInput(procura),
      n_candidato: nCand,
    });
    if (outcome === 'incompatible') n += 1;
  }
  return n;
}
