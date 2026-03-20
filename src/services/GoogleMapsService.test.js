import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlacePredictions, getPlaceDetails } from './GoogleMapsService';

describe('GoogleMapsService', () => {
  const mockApiKey = 'mock-api-key';
  const mockSessionToken = 'mock-session-token';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', mockApiKey);
    global.fetch = vi.fn();
    // Silence console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('getPlacePredictions', () => {
    it('returns empty array if input is empty', async () => {
      const result = await getPlacePredictions('', mockSessionToken);
      expect(result).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('throws error if API key is not configured', async () => {
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
      await expect(getPlacePredictions('Luanda', mockSessionToken)).rejects.toThrow('Chave de API do Google Maps não configurada.');
    });

    it('returns predictions on success (status OK)', async () => {
      const mockPredictions = [{ description: 'Luanda, Angola', place_id: '123' }];
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'OK', predictions: mockPredictions })
      });

      const result = await getPlacePredictions('Luanda', mockSessionToken);

      expect(fetch).toHaveBeenCalledWith(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Luanda&components=country:ao&sessiontoken=${mockSessionToken}&key=${mockApiKey}`
      );
      expect(result).toEqual(mockPredictions);
    });

    it('returns empty array on ZERO_RESULTS', async () => {
       global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ZERO_RESULTS', predictions: [] })
      });

      const result = await getPlacePredictions('UnknownPlace123', mockSessionToken);
      expect(result).toEqual([]);
    });

    it('throws error on non-OK HTTP status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(getPlacePredictions('Luanda', mockSessionToken)).rejects.toThrow('Erro HTTP: 500');
    });

    it('throws error if API returns an error status', async () => {
       global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'INVALID_REQUEST' })
      });

      await expect(getPlacePredictions('Luanda', mockSessionToken)).rejects.toThrow('Google Maps API Erro: INVALID_REQUEST');
    });
  });

  describe('getPlaceDetails', () => {
    it('returns null if placeId is empty', async () => {
      const result = await getPlaceDetails('', mockSessionToken);
      expect(result).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('throws error if API key is not configured', async () => {
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Chave de API do Google Maps não configurada.');
    });

    it('returns coordinates on success', async () => {
      const mockLat = -8.839988;
      const mockLng = 13.289437;
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          result: {
            geometry: {
              location: { lat: mockLat, lng: mockLng }
            }
          }
        })
      });

      const result = await getPlaceDetails('123', mockSessionToken);

      expect(fetch).toHaveBeenCalledWith(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=123&fields=geometry&sessiontoken=${mockSessionToken}&key=${mockApiKey}`
      );
      expect(result).toEqual({ lat: mockLat, lng: mockLng });
    });

    it('throws error if geometry is missing', async () => {
       global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'OK',
          result: {}
        })
      });

      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Coordenadas não encontradas para o local.');
    });

    it('throws error on non-OK HTTP status', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Erro HTTP: 404');
    });

    it('throws error if API returns an error status', async () => {
       global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'REQUEST_DENIED' })
      });

      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Google Maps API Erro: REQUEST_DENIED');
    });
  });
});
