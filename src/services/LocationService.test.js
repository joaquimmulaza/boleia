import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getPlacePredictions, getPlaceDetails } from './LocationService';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Photon GeoJSON response factory
const makePhotonResponse = (features = []) => ({
  type: 'FeatureCollection',
  features,
});

const makeFeature = ({ osm_id = 123456, name = 'Talatona', city = 'Luanda', country = 'Angola', street = null, lat = -8.838, lng = 13.234 } = {}) => ({
  geometry: { coordinates: [lng, lat], type: 'Point' },
  properties: { osm_id, name, city, country, ...(street ? { street } : {}) },
});

describe('LocationService (OpenStreetMap / Photon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getPlacePredictions ───────────────────────────────────────────────────

  describe('getPlacePredictions', () => {
    it('retorna [] imediatamente se input for vazio (sem fetch)', async () => {
      const result = await getPlacePredictions('');
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('retorna [] imediatamente se input tiver menos de 3 caracteres (sem fetch)', async () => {
      const result = await getPlacePredictions('Lu');
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('chama a API Photon com query e filtro countrycode=ao', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makePhotonResponse([makeFeature()]),
      });

      await getPlacePredictions('Talatona');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('photon.komoot.io');
      expect(calledUrl).toContain('q=Talatona');
      expect(calledUrl).toContain('countrycode=ao');
    });

    it('mapeia features do GeoJSON para o formato interno { place_id, description, lat, lng }', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makePhotonResponse([
          makeFeature({ osm_id: 111, name: 'Talatona', city: 'Luanda', country: 'Angola', lat: -8.838, lng: 13.234 }),
        ]),
      });

      const result = await getPlacePredictions('Talatona');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        place_id: 'osm-111',
        description: expect.stringContaining('Talatona'),
        lat: -8.838,
        lng: 13.234,
      });
    });

    it('retorna [] quando a API retorna FeatureCollection vazia (sem resultados)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makePhotonResponse([]),
      });

      const result = await getPlacePredictions('XYZ_Inexistente');
      expect(result).toEqual([]);
    });

    it('retorna [] e não lança exceção em caso de erro de rede', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await getPlacePredictions('Mutamba');
      expect(result).toEqual([]);
    });

    it('retorna [] e não lança exceção se a API responde com HTTP 500', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await getPlacePredictions('Kilamba');
      expect(result).toEqual([]);
    });

    it('monta description composta com street, city e country quando street está presente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => makePhotonResponse([
          makeFeature({ osm_id: 999, name: 'Mutamba', city: 'Luanda', country: 'Angola', street: 'Rua da Missão', lat: -8.82, lng: 13.24 }),
        ]),
      });

      const result = await getPlacePredictions('Mutamba');
      expect(result[0].description).toContain('Mutamba');
      expect(result[0].description).toContain('Luanda');
      expect(result[0].description).toContain('Angola');
    });
  });

  // ─── getPlaceDetails ───────────────────────────────────────────────────────

  describe('getPlaceDetails', () => {
    it('retorna null se placeId for nulo ou vazio', async () => {
      expect(await getPlaceDetails(null, [])).toBeNull();
      expect(await getPlaceDetails('', [])).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('resolve coordenadas instantaneamente a partir do cache local (cachedSuggestions)', async () => {
      const cachedSuggestions = [
        { place_id: 'osm-111', description: 'Talatona, Luanda, Angola', lat: -8.838, lng: 13.234 },
        { place_id: 'osm-222', description: 'Mutamba, Luanda, Angola', lat: -8.82, lng: 13.24 },
      ];

      const result = await getPlaceDetails('osm-111', cachedSuggestions);

      expect(result).toEqual({ lat: -8.838, lng: 13.234 });
      expect(mockFetch).not.toHaveBeenCalled(); // sem chamada extra à API
    });

    it('retorna null se placeId não é encontrado no cache e não existe fallback', async () => {
      const cachedSuggestions = [
        { place_id: 'osm-111', description: 'Talatona, Luanda, Angola', lat: -8.838, lng: 13.234 },
      ];

      const result = await getPlaceDetails('osm-999', cachedSuggestions);
      expect(result).toBeNull();
    });

    it('retorna null quando cachedSuggestions está vazio e placeId não é resolvível', async () => {
      const result = await getPlaceDetails('osm-999', []);
      expect(result).toBeNull();
    });
  });
});
