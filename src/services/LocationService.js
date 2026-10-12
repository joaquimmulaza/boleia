// src/services/LocationService.js
// Geocoding & Autocomplete via OpenStreetMap (Nominatim)
// Sem API Key. Filtrado para Angola (countrycodes=ao) com preferência Luanda (viewbox).

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const MIN_INPUT_LENGTH = 3;
const RESULTS_LIMIT = 8;
const NOMINATIM_USER_AGENT = 'BoleiaCerta/1.0 (contact: joaquimmulazadev@gmail.com)';

/** viewbox Nominatim: min_lon,max_lat,max_lon,min_lat — Luanda metropolitana (sem bounded). */
export const LUANDA_NOMINATIM_VIEWBOX = '13.10,-8.72,13.50,-9.08';

/**
 * @param {Record<string, string | undefined>} address
 * @param {object} [item]
 * @returns {{ bairro: string | null, municipio: string | null }}
 */
export const extractBairroMunicipio = (address = {}, item = {}) => {
  const villageAsBairro =
    item.class !== 'boundary' && item.type !== 'administrative' ? address.village : null;
  const bairro =
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    villageAsBairro ||
    null;
  const municipio =
    address.city_district ||
    address.county ||
    address.city ||
    address.municipality ||
    null;
  return { bairro, municipio };
};

/**
 * @param {object} item - Resultado Nominatim.
 * @returns {{ place_id: string, description: string, lat: number, lng: number, _rank: number }}
 */
export const mapNominatimResult = (item) => {
  const { bairro, municipio } = extractBairroMunicipio(item.address, item);
  let description;
  let rank;

  if (bairro && municipio) {
    description = `${bairro}, ${municipio}`;
    rank = 0;
  } else if (bairro) {
    description = bairro;
    rank = 0;
  } else if (municipio) {
    description = municipio;
    rank = 1;
  } else {
    description = (item.display_name || '').split(',')[0]?.trim() || item.name || '';
    rank = 2;
  }

  return {
    place_id: `nominatim-${item.place_id}`,
    description,
    lat: Number.parseFloat(item.lat),
    lng: Number.parseFloat(item.lon),
    _rank: rank,
  };
};

/**
 * @param {Array<{ _rank: number }>} items
 */
export const sortNominatimResults = (items) =>
  [...items].sort((a, b) => a._rank - b._rank);

/**
 * @param {Record<string, string | undefined>} address
 */
export const isLuandaMetroAddress = (address = {}) => {
  const state = address.state || '';
  if (state.includes('Luanda')) return true;
  return address['ISO3166-2-lvl4'] === 'AO-LUA';
};

/**
 * @param {string} query
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<object[]>}
 */
const fetchNominatimRaw = async (query, signal) => {
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    countrycodes: 'ao',
    viewbox: LUANDA_NOMINATIM_VIEWBOX,
    addressdetails: '1',
    limit: String(RESULTS_LIMIT),
  });

  const url = `${NOMINATIM_SEARCH_URL}?${params.toString()}`;
  const response = await fetch(url, {
    signal,
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'pt',
      'User-Agent': NOMINATIM_USER_AGENT,
    },
  });

  if (!response.ok) {
    console.warn(`[LocationService] Nominatim respondeu com status ${response.status}`);
    return [];
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/**
 * Busca sugestões de locais no Nominatim (Angola + preferência Luanda).
 *
 * @param {string} input
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Array<{ place_id: string, description: string, lat: number, lng: number }>>}
 */
export const getPlacePredictions = async (input, options = {}) => {
  if (!input || input.length < MIN_INPUT_LENGTH) {
    return [];
  }

  const trimmed = input.trim();
  const assistQuery = trimmed.toLowerCase().startsWith('bairro ')
    ? null
    : `bairro ${trimmed}`;

  try {
    const [primaryRows, assistRows] = await Promise.all([
      fetchNominatimRaw(trimmed, options.signal),
      assistQuery
        ? fetchNominatimRaw(assistQuery, options.signal)
        : Promise.resolve([]),
    ]);

    const byId = new Map();
    for (const row of [...primaryRows, ...assistRows]) {
      if (!row?.place_id) continue;
      const address = row.address || {};
      if (address.state && !isLuandaMetroAddress(address)) {
        continue;
      }
      byId.set(row.place_id, row);
    }

    return sortNominatimResults([...byId.values()].map(mapNominatimResult))
      .slice(0, RESULTS_LIMIT)
      .map(({ _rank, ...rest }) => rest);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.warn('[LocationService] Erro ao contactar Nominatim:', error.message);
    return [];
  }
};

/**
 * @param {string} placeId
 * @param {Array<{ place_id: string, lat: number, lng: number }>} cachedSuggestions
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export const getPlaceDetails = async (placeId, cachedSuggestions = []) => {
  if (!placeId) return null;

  const found = cachedSuggestions.find((s) => s.place_id === placeId);
  if (!found) return null;

  return { lat: found.lat, lng: found.lng };
};
