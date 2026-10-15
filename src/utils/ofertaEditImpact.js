import { evaluateMatch } from './matchingFilters.js';
import { toOfertaMatchInput, toProcuraMatchInput } from './matchInput.js';

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
