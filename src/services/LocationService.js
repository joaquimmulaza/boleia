// src/services/LocationService.js
// Geocoding & Autocomplete via OpenStreetMap (Photon API by Komoot)
// Sem API Key. 100% gratuito. Filtrado para Angola (countrycode=ao).

const PHOTON_BASE_URL = 'https://photon.komoot.io/api/';
const MIN_INPUT_LENGTH = 3;
const RESULTS_LIMIT = 5;

/**
 * Formata uma feature GeoJSON do Photon para o formato interno da Boleia Certa.
 * @param {object} feature - Feature GeoJSON retornada pela API Photon.
 * @returns {{ place_id: string, description: string, lat: number, lng: number }}
 */
const mapFeature = (feature) => {
  const { geometry, properties } = feature;
  const [lng, lat] = geometry.coordinates;
  const { osm_id, name, city, country, street } = properties;

  // Compõe uma descrição legível: "Nome, Rua, Cidade, País"
  const parts = [name, street, city, country].filter(Boolean);
  const description = parts.join(', ');

  return {
    place_id: `osm-${osm_id}`,
    description,
    lat,
    lng,
  };
};

/**
 * Busca sugestões de locais na API Photon filtradas para Angola.
 * Retorna [] se input < 3 chars ou em caso de qualquer erro (sem lançar exceção).
 *
 * @param {string} input - Texto digitado pelo utilizador.
 * @returns {Promise<Array<{ place_id: string, description: string, lat: number, lng: number }>>}
 */
export const getPlacePredictions = async (input) => {
  if (!input || input.length < MIN_INPUT_LENGTH) {
    return [];
  }

  try {
    const url = `${PHOTON_BASE_URL}?q=${encodeURIComponent(input)}&countrycode=ao&limit=${RESULTS_LIMIT}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[LocationService] Photon API respondeu com status ${response.status}`);
      return [];
    }

    const data = await response.json();
    const features = data?.features ?? [];

    return features.map(mapFeature);
  } catch (error) {
    console.warn('[LocationService] Erro ao contactar Photon API:', error.message);
    return [];
  }
};

/**
 * Resolve as coordenadas { lat, lng } de um placeId a partir do cache local.
 * O Photon já inclui as coordenadas na resposta de autocomplete, portanto
 * não é necessária uma segunda chamada de rede.
 *
 * @param {string} placeId - ID interno no formato "osm-{osm_id}".
 * @param {Array<{ place_id: string, lat: number, lng: number }>} cachedSuggestions - Últimas sugestões retornadas.
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export const getPlaceDetails = async (placeId, cachedSuggestions = []) => {
  if (!placeId) return null;

  const found = cachedSuggestions.find((s) => s.place_id === placeId);
  if (!found) return null;

  return { lat: found.lat, lng: found.lng };
};
