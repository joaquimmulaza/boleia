// src/services/LocationService.js
// Geocoding & Autocomplete via OpenStreetMap (Photon API by Komoot)
// Sem API Key. Viés Luanda (lat/lon) + filtro Angola no cliente.

import { normalizeGeocoderLabel } from '../utils/normalizeGeocoderLabel';

const PHOTON_BASE_URL = 'https://photon.komoot.io/api/';
const MIN_INPUT_LENGTH = 3;
const RESULTS_LIMIT = 8;

/** Centro Luanda — viés Photon (lat/lon). */
export const LUANDA_PHOTON_LAT = -8.839;
export const LUANDA_PHOTON_LON = 13.289;

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
 * @param {object} properties - Propriedades Photon.
 * @returns {Record<string, string | undefined>}
 */
export const photonPropertiesToAddress = (properties = {}) => {
  const state = properties.state || '';
  return {
    suburb: properties.district || undefined,
    neighbourhood:
      properties.type === 'locality' || properties.osm_value === 'suburb'
        ? properties.name
        : properties.neighbourhood,
    city: properties.city,
    county: properties.county,
    city_district: properties.city_district,
    state,
    village: properties.type === 'locality' ? properties.name : undefined,
    'ISO3166-2-lvl4':
      properties.countrycode === 'AO' && state.includes('Luanda') ? 'AO-LUA' : undefined,
  };
};

/**
 * @param {object} feature - Feature GeoJSON Photon.
 * @returns {{ place_id: string, description: string, lat: number, lng: number, _rank: number }}
 */
export const mapPhotonFeature = (feature) => {
  const { geometry, properties = {} } = feature;
  const coordinates = geometry?.coordinates;
  const lng =
    Array.isArray(coordinates) && coordinates.length >= 2 ? Number(coordinates[0]) : null;
  const lat =
    Array.isArray(coordinates) && coordinates.length >= 2 ? Number(coordinates[1]) : null;
  const address = photonPropertiesToAddress(properties);
  const itemMeta = {
    class: properties.osm_key === 'boundary' ? 'boundary' : properties.osm_key,
    type: properties.osm_value === 'administrative' ? 'administrative' : properties.type,
  };
  const { bairro, municipio } = extractBairroMunicipio(address, itemMeta);
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
    description = properties.name || '';
    rank = 2;
  }

  return {
    place_id: `photon-${properties.osm_id}`,
    description,
    lat,
    lng,
    _metroLuanda: isLuandaMetroAddress(address) ? 0 : 1,
    _rank: rank,
  };
};

/**
 * Luanda primeiro (viés), depois granularidade bairro → município.
 * @param {Array<{ _metroLuanda?: number, _rank: number }>} items
 */
export const sortNominatimResults = (items) =>
  [...items].sort((a, b) => {
    const metro = (a._metroLuanda ?? 1) - (b._metroLuanda ?? 1);
    if (metro !== 0) return metro;
    return a._rank - b._rank;
  });

/**
 * @param {Record<string, string | undefined>} address
 */
export const isLuandaMetroAddress = (address = {}) => {
  const state = address.state || '';
  if (state.includes('Luanda')) return true;
  return address['ISO3166-2-lvl4'] === 'AO-LUA';
};

/**
 * @param {object} feature - Feature GeoJSON Photon.
 * @returns {boolean}
 */
export const photonFeatureHasBairro = (feature) => {
  const properties = feature?.properties ?? {};
  if (properties.countrycode && properties.countrycode !== 'AO') {
    return false;
  }
  const address = photonPropertiesToAddress(properties);
  const itemMeta = {
    class: properties.osm_key === 'boundary' ? 'boundary' : properties.osm_key,
    type: properties.osm_value === 'administrative' ? 'administrative' : properties.type,
  };
  const { bairro } = extractBairroMunicipio(address, itemMeta);
  return Boolean(bairro);
};

/**
 * @param {string} query
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<object[]>}
 */
const fetchPhotonRaw = async (query, signal) => {
  const params = new URLSearchParams({
    q: query,
    lat: String(LUANDA_PHOTON_LAT),
    lon: String(LUANDA_PHOTON_LON),
    limit: String(RESULTS_LIMIT),
    countrycode: 'ao',
  });

  const url = `${PHOTON_BASE_URL}?${params.toString()}`;
  const response = await fetch(url, { signal });

  if (!response.ok) {
    const err = new Error(`Photon respondeu com status ${response.status}`);
    err.status = response.status;
    err.errorKind = 'network';
    console.warn(`[LocationService] ${err.message}`);
    throw err;
  }

  const data = await response.json();
  const features = data?.features ?? [];
  return Array.isArray(features) ? features : [];
};

/**
 * Busca sugestões de locais no Photon (viés Luanda + filtro Angola no cliente).
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
    const primaryFeatures = await fetchPhotonRaw(trimmed, options.signal);
    const primaryHasBairro = primaryFeatures.some(photonFeatureHasBairro);

    let assistFeatures = [];
    if (assistQuery && !primaryHasBairro) {
      try {
        assistFeatures = await fetchPhotonRaw(assistQuery, options.signal);
      } catch (assistError) {
        if (assistError?.name === 'AbortError') {
          throw assistError;
        }
        console.warn(
          '[LocationService] Pesquisa assistida «bairro …» falhou:',
          assistError?.message ?? assistError,
        );
      }
    }

    const byId = new Map();
    for (const feature of [...primaryFeatures, ...assistFeatures]) {
      const properties = feature?.properties;
      if (!properties?.osm_id) continue;
      if (properties.countrycode && properties.countrycode !== 'AO') {
        continue;
      }
      byId.set(properties.osm_id, feature);
    }

    const mapped = sortNominatimResults([...byId.values()].map(mapPhotonFeature));
    const seenLabels = new Set();
    const deduped = [];
    for (const item of mapped) {
      if (item.lat == null || item.lng == null) {
        continue;
      }
      const key = normalizeGeocoderLabel(item.description);
      if (seenLabels.has(key)) continue;
      seenLabels.add(key);
      deduped.push(item);
    }

    return deduped
      .slice(0, RESULTS_LIMIT)
      .map(({ _rank, _metroLuanda, ...rest }) => rest);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw error;
    }
    console.warn('[LocationService] Erro ao contactar Photon:', error.message);
    throw error;
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
