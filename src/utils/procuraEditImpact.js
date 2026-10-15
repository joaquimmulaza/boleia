import { evaluateMatch } from './matchingFilters.js';
import { toOfertaMatchInput, toProcuraMatchInput } from './matchInput.js';

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
