import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getPlacePredictions,
  getPlaceDetails,
  LUANDA_NOMINATIM_VIEWBOX,
} from './LocationService';

const mockFetch = vi.fn();
global.fetch = mockFetch;

/**
 * @param {object} overrides
 */
const makeNominatimItem = ({
  place_id = 100,
  lat = '-8.838',
  lon = '13.234',
  address = {},
  display_name = 'Fallback',
} = {}) => ({
  place_id,
  lat,
  lon,
  display_name,
  address,
});

describe('LocationService (OpenStreetMap / Nominatim)', () => {
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

    it('chama Nominatim com countrycodes=ao e viewbox de Luanda (sem bounded)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await getPlacePredictions('Talatona');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, options] = mockFetch.mock.calls[0];
      expect(calledUrl).toContain('nominatim.openstreetmap.org/search');
      expect(calledUrl).toContain('countrycodes=ao');
      expect(calledUrl).toContain(`viewbox=${encodeURIComponent(LUANDA_NOMINATIM_VIEWBOX)}`);
      expect(calledUrl).not.toContain('bounded=1');
      expect(calledUrl).toContain('q=Talatona');
      expect(options?.signal).toBeUndefined();
    });

    it('propaga AbortSignal ao fetch', async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await getPlacePredictions('Viana', { signal: controller.signal });

      expect(mockFetch.mock.calls[0][1].signal).toBe(controller.signal);
    });

    it('formata sugestões como «Bairro, Município» a partir de suburb e city', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeNominatimItem({
            place_id: 1,
            address: { suburb: 'Talatona', city: 'Luanda' },
          }),
        ],
      });

      const result = await getPlacePredictions('Talatona');
      expect(result[0].description).toBe('Talatona, Luanda');
      expect(result[0].place_id).toBe('nominatim-1');
      expect(result[0].lat).toBeCloseTo(-8.838);
      expect(result[0].lng).toBeCloseTo(13.234);
    });

    it('ordena resultados ao nível bairro antes de entradas só município', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          makeNominatimItem({
            place_id: 10,
            address: { city: 'Luanda' },
            display_name: 'Luanda',
          }),
          makeNominatimItem({
            place_id: 11,
            address: { neighbourhood: 'Viana', county: 'Viana' },
          }),
          makeNominatimItem({
            place_id: 12,
            address: { quarter: 'Kilamba', city_district: 'Belas' },
          }),
        ],
      });

      const result = await getPlacePredictions('Viana');
      expect(result.map((r) => r.place_id)).toEqual([
        'nominatim-11',
        'nominatim-12',
        'nominatim-10',
      ]);
      expect(result[2].description).toBe('Luanda');
    });

    it('retorna [] quando Nominatim não devolve resultados', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
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

  describe('getPlaceDetails', () => {
    it('retorna null se placeId for nulo ou vazio', async () => {
      expect(await getPlaceDetails(null, [])).toBeNull();
      expect(await getPlaceDetails('', [])).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('resolve coordenadas a partir do cache local', async () => {
      const cachedSuggestions = [
        { place_id: 'nominatim-111', description: 'Talatona, Luanda', lat: -8.838, lng: 13.234 },
      ];

      const result = await getPlaceDetails('nominatim-111', cachedSuggestions);
      expect(result).toEqual({ lat: -8.838, lng: 13.234 });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
