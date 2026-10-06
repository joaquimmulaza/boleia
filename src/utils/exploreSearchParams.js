/**
 * @param {URLSearchParams} params
 * @returns {{
 *   origem: string,
 *   destino: string,
 *   origin_lat: number | null,
 *   origin_lng: number | null,
 *   destination_lat: number | null,
 *   destination_lng: number | null,
 * } | null}
 */
export function parseExploreSearchParams(params) {
  const origem = params.get('origem')?.trim() || '';
  const destino = params.get('destino')?.trim() || '';
  if (!origem || !destino) return null;

  const toCoord = (key) => {
    const raw = params.get(key);
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  return {
    origem,
    destino,
    origin_lat: toCoord('origem_lat'),
    origin_lng: toCoord('origem_lng'),
    destination_lat: toCoord('destino_lat'),
    destination_lng: toCoord('destino_lng'),
  };
}

/**
 * @param {{
 *   origem: string,
 *   destino: string,
 *   origin_lat: number,
 *   origin_lng: number,
 *   destination_lat: number,
 *   destination_lng: number,
 * }} payload
 * @returns {string}
 */
export function buildExploreSearchQuery(payload) {
  const q = new URLSearchParams({
    origem: payload.origem,
    destino: payload.destino,
    origem_lat: String(payload.origin_lat),
    origem_lng: String(payload.origin_lng),
    destino_lat: String(payload.destination_lat),
    destino_lng: String(payload.destination_lng),
  });
  return q.toString();
}

/**
 * @param {{ origem?: string, destino?: string } | null | undefined} search
 * @returns {boolean}
 */
export function hasExploreSearchLabels(search) {
  return Boolean(search?.origem?.trim() && search?.destino?.trim());
}

/**
 * @param {{ origem: string, destino: string }} search
 * @returns {string}
 */
export function exploreFilteredTitle(search) {
  return `Boleias de ${search.origem} para ${search.destino}`;
}
