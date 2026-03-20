import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPlacePredictions, getPlaceDetails } from './GoogleMapsService';

describe('GoogleMapsService', () => {
  const mockApiKey = 'mock-api-key';
  const mockSessionToken = { token: 'mock-session-token-object' };

  const originalCreateElement = document.createElement.bind(document);

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', mockApiKey);
    
    // reset DOM
    document.head.innerHTML = '';
    
    // default global mock
    global.window.google = {
      maps: {
        places: {
          AutocompleteSuggestion: {
            fetchAutocompleteSuggestions: vi.fn()
          },
          PlacesService: vi.fn(),
          AutocompleteSessionToken: vi.fn().mockImplementation(() => 'new-session-token'),
          PlacesServiceStatus: {
            OK: 'OK',
            ZERO_RESULTS: 'ZERO_RESULTS',
            INVALID_REQUEST: 'INVALID_REQUEST',
            REQUEST_DENIED: 'REQUEST_DENIED'
          }
        }
      }
    };

    // Silence console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Mock document.createElement to handle script loading
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'script') {
        setTimeout(() => {
          if (el.onload) el.onload();
        }, 0);
      }
      return el;
    });
  });

  describe('getPlacePredictions', () => {
    it('returns empty array if input is empty', async () => {
      const result = await getPlacePredictions('', mockSessionToken);
      expect(result).toEqual([]);
    });

    it('throws error if API key is not configured', async () => {
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
      delete window.google; // Ensure script needs to load
      await expect(getPlacePredictions('Luanda', mockSessionToken)).rejects.toThrow('Chave de API do Google Maps não configurada.');
    });

    it('returns predictions on success', async () => {
      const mockResponse = {
        suggestions: [
          {
            placePrediction: {
              text: { text: 'Luanda, Angola' },
              placeId: '123'
            }
          }
        ]
      };
      
      window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions.mockResolvedValueOnce(mockResponse);

      const result = await getPlacePredictions('Luanda', mockSessionToken);

      expect(window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions).toHaveBeenCalledWith({
        input: 'Luanda',
        includedRegionCodes: ['AO'],
        sessionToken: mockSessionToken
      });
      
      expect(result).toEqual([{ description: 'Luanda, Angola', place_id: '123' }]);
    });

    it('returns empty array if no suggestions', async () => {
      window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions.mockResolvedValueOnce({ suggestions: [] });

      const result = await getPlacePredictions('UnknownPlace123', mockSessionToken);
      expect(result).toEqual([]);
    });

    it('throws error on API error', async () => {
      window.google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions.mockRejectedValueOnce(new Error('INVALID_REQUEST'));

      await expect(getPlacePredictions('Luanda', mockSessionToken)).rejects.toThrow('INVALID_REQUEST');
    });
  });

  describe('getPlaceDetails', () => {
    it('returns null if placeId is empty', async () => {
      const result = await getPlaceDetails('', mockSessionToken);
      expect(result).toBeNull();
    });

    it('throws error if API key is not configured', async () => {
      vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');
      delete window.google;
      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Chave de API do Google Maps não configurada.');
    });

    it('returns coordinates on success', async () => {
      const mockLat = -8.839988;
      const mockLng = 13.289437;
      
      const getDetailsMock = vi.fn((request, callback) => {
        expect(request.placeId).toBe('123');
        expect(request.fields).toEqual(['geometry']);
        expect(request.sessionToken).toBe(mockSessionToken);
        callback({
          geometry: {
            location: {
              lat: () => mockLat,
              lng: () => mockLng
            }
          }
        }, 'OK');
      });

      window.google.maps.places.PlacesService.mockImplementation(function() {
        return {
          getDetails: getDetailsMock
        };
      });

      const result = await getPlaceDetails('123', mockSessionToken);

      expect(getDetailsMock).toHaveBeenCalled();
      expect(result).toEqual({ lat: mockLat, lng: mockLng });
    });

    it('throws error if geometry is missing', async () => {
      const getDetailsMock = vi.fn((request, callback) => {
        callback({}, 'OK');
      });

      window.google.maps.places.PlacesService.mockImplementation(function() {
        return {
          getDetails: getDetailsMock
        };
      });

      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Coordenadas não encontradas para o local.');
    });

    it('throws error on API error status', async () => {
      const getDetailsMock = vi.fn((request, callback) => {
        callback(null, 'REQUEST_DENIED');
      });

      window.google.maps.places.PlacesService.mockImplementation(function() {
        return {
          getDetails: getDetailsMock
        };
      });

      await expect(getPlaceDetails('123', mockSessionToken)).rejects.toThrow('Google Maps API Erro: REQUEST_DENIED');
    });
  });
});
