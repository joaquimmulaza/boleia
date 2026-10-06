import {
  isOriginWithinRadius,
  isDestinationWithinRadius,
} from './matchingFilters';

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isFiniteCoord(value) {
  return value != null && value !== '' && Number.isFinite(Number(value));
}

/**
 * @param {{
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 * } | null | undefined} search
 * @returns {boolean}
 */
export function isSearchOdActive(search) {
  if (!search) return false;
  return (
    isFiniteCoord(search.origin_lat)
    && isFiniteCoord(search.origin_lng)
    && isFiniteCoord(search.destination_lat)
    && isFiniteCoord(search.destination_lng)
  );
}

/**
 * @param {{
 *   origin_lat?: number | null,
 *   origin_lng?: number | null,
 *   destination_lat?: number | null,
 *   destination_lng?: number | null,
 * }} side
 * @returns {boolean}
 */
function hasCompleteOd(side) {
  return (
    isFiniteCoord(side?.origin_lat)
    && isFiniteCoord(side?.origin_lng)
    && isFiniteCoord(side?.destination_lat)
    && isFiniteCoord(side?.destination_lng)
  );
}

/**
 * Filtra ofertas fixas cujo OD cai no raio da pesquisa (ambos origem e destino).
 * Ofertas flexíveis e sem OD completo ficam de fora.
 *
 * @param {Array<{ flexibilidade_rota?: boolean, origin_lat?: number | null, origin_lng?: number | null, destination_lat?: number | null, destination_lng?: number | null, [key: string]: unknown }>} ofertas
 * @param {Parameters<typeof isSearchOdActive>[0]} search
 * @returns {typeof ofertas}
 */
export function filterOfertasBySearchOd(ofertas, search) {
  if (!isSearchOdActive(search)) return ofertas;

  return ofertas.filter((oferta) => {
    if (oferta?.flexibilidade_rota) return false;
    if (!hasCompleteOd(oferta)) return false;

    const originOk = isOriginWithinRadius(
      Number(oferta.origin_lat),
      Number(oferta.origin_lng),
      Number(search.origin_lat),
      Number(search.origin_lng),
    );
    const destOk = isDestinationWithinRadius(
      Number(oferta.destination_lat),
      Number(oferta.destination_lng),
      Number(search.destination_lat),
      Number(search.destination_lng),
    );

    return originOk && destOk;
  });
}
