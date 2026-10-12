import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPlacePredictions,
  getPlaceDetails,
  LUANDA_PHOTON_LAT,
  LUANDA_PHOTON_LON,
  mapPhotonFeature,
} from './LocationService';

const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * @param {object} overrides
 */
const makePhotonFeature = ({
  osm_id = 100,
  lat = -8.838,
  lng = 13.234,
  properties = {},
} = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: {
    osm_id,
    countrycode: 'AO',
    state: 'Luanda',
    ...properties,
  },
});

describe('LocationService (OpenStreetMap / Photon)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

    it('chama Photon com viés Luanda (lat/lon) e sem header User-Agent', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      });

      await getPlacePredictions('Talatona');

      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(1);
      const [calledUrl, options] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('photon.komoot.io/api/');
      expect(calledUrl).toContain(`lat=${LUANDA_PHOTON_LAT}`);
      expect(calledUrl).toContain(`lon=${LUANDA_PHOTON_LON}`);
      expect(calledUrl).toContain('q=Talatona');
      expect(calledUrl).toContain('countrycode=ao');
      expect(options?.headers?.['User-Agent']).toBeUndefined();
      expect(options?.signal).toBeUndefined();
    });

    it('propaga AbortSignal ao fetch', async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ features: [] }),
      });

      await getPlacePredictions('Viana', { signal: controller.signal });

      expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
    });

    it('formata sugestões como «Bairro, Município» a partir de district e county', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            makePhotonFeature({
              osm_id: 1,
              properties: {
                district: 'Talatona',
                county: 'Município do Talatona',
                name: 'Talatona',
                osm_key: 'place',
                osm_value: 'suburb',
                type: 'district',
              },
            }),
          ],
        }),
      });

      const result = await getPlacePredictions('Talatona');
      expect(result[0].description).toBe('Talatona, Município do Talatona');
      expect(result[0].place_id).toBe('photon-1');
      expect(result[0].lat).toBeCloseTo(-8.838);
      expect(result[0].lng).toBeCloseTo(13.234);
    });

    it('ordena resultados ao nível bairro antes de entradas só município', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            features: [
              makePhotonFeature({
                osm_id: 10,
                properties: {
                  name: 'Luanda',
                  county: 'Luanda',
                  osm_key: 'boundary',
                  osm_value: 'administrative',
                  type: 'county',
                },
              }),
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            features: [
              makePhotonFeature({
                osm_id: 11,
                properties: {
                  name: 'Viana',
                  district: 'Viana',
                  county: 'Município de Viana',
                  osm_value: 'suburb',
                  type: 'district',
                },
              }),
              makePhotonFeature({
                osm_id: 12,
                properties: {
                  name: 'Kilamba',
                  district: 'Kilamba',
                  county: 'Belas',
                  type: 'locality',
                },
              }),
            ],
          }),
        });

      const result = await getPlacePredictions('Viana');
      expect(result.map((r) => r.place_id)).toEqual([
        'photon-11',
        'photon-12',
        'photon-10',
      ]);
    });

    it('dispara pesquisa assistida «bairro {termo}» para enriquecer municípios', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ features: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ features: [] }),
        });

      await getPlacePredictions('Talatona');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain('q=bairro+Talatona');
    });

    it('inclui Angola fora de Luanda e lista Luanda primeiro (sem filtro rígido)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            makePhotonFeature({
              osm_id: 50,
              properties: {
                name: 'Benguela',
                state: 'Benguela',
                countrycode: 'AO',
                osm_value: 'city',
                type: 'city',
              },
            }),
            makePhotonFeature({
              osm_id: 51,
              properties: {
                district: 'Viana',
                county: 'Município de Viana',
                name: 'Viana',
                state: 'Luanda',
                countrycode: 'AO',
                osm_value: 'suburb',
                type: 'district',
              },
            }),
          ],
        }),
      });

      const result = await getPlacePredictions('Via');
      expect(result).toHaveLength(2);
      expect(result[0].place_id).toBe('photon-51');
      expect(result[1].place_id).toBe('photon-50');
    });

    it('exclui resultados fora de Angola no cliente', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            makePhotonFeature({
              osm_id: 99,
              properties: { countrycode: 'PT', state: 'Lisboa', name: 'Lisboa' },
            }),
            makePhotonFeature({
              osm_id: 1,
              properties: {
                district: 'Talatona',
                county: 'Município do Talatona',
                countrycode: 'AO',
                state: 'Luanda',
              },
            }),
          ],
        }),
      });

      const result = await getPlacePredictions('Tal');
      expect(result).toHaveLength(1);
      expect(result[0].place_id).toBe('photon-1');
    });

    it('retorna [] quando Photon não devolve resultados', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      });

      const result = await getPlacePredictions('XYZ_Inexistente');
      expect(result).toEqual([]);
    });

    it('retorna [] e não lança exceção em caso de erro de rede', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      const result = await getPlacePredictions('Mutamba');
      expect(result).toEqual([]);
    });

    it('re-lança AbortError para o hook cancelar pedidos obsoletos', async () => {
      mockFetch.mockRejectedValueOnce(Object.assign(new Error('Aborted'), { name: 'AbortError' }));

      await expect(getPlacePredictions('Talatona', { signal: new AbortController().signal }))
        .rejects.toMatchObject({ name: 'AbortError' });
    });
  });

  describe('mapPhotonFeature', () => {
    it('mapeia coordenadas GeoJSON [lng, lat]', () => {
      const mapped = mapPhotonFeature(
        makePhotonFeature({ lat: -9.1, lng: 13.5, properties: { osm_id: 7, name: 'Teste' } }),
      );
      expect(mapped.lat).toBeCloseTo(-9.1);
      expect(mapped.lng).toBeCloseTo(13.5);
    });
  });

  describe('getPlaceDetails', () => {
    it('retorna null se placeId for nulo ou vazio', async () => {
      expect(await getPlaceDetails(null, [])).toBeNull();
      expect(await getPlaceDetails('', [])).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('resolve coordenadas a partir do cache local', async () => {
      const cachedSuggestions = [
        { place_id: 'photon-111', description: 'Talatona, Luanda', lat: -8.838, lng: 13.234 },
      ];

      const result = await getPlaceDetails('photon-111', cachedSuggestions);
      expect(result).toEqual({ lat: -8.838, lng: 13.234 });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
