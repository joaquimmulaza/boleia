import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutocomplete } from './useAutocomplete';

const getPlacePredictions = vi.fn();

vi.mock('../services/LocationService', () => ({
  getPlacePredictions: (...args) => getPlacePredictions(...args),
  getPlaceDetails: vi.fn(),
}));

describe('useAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passa AbortSignal ao LocationService e ignora resposta de pedido obsoleto', async () => {
    let resolveSlow;
    const slowPromise = new Promise((resolve) => {
      resolveSlow = resolve;
    });

    getPlacePredictions
      .mockReturnValueOnce(slowPromise)
      .mockResolvedValueOnce([
        { place_id: 'nominatim-2', description: 'Viana, Viana', lat: 1, lng: 2 },
      ]);

    const { result } = renderHook(() => useAutocomplete());

    await act(async () => {
      void result.current.fetchPredictions('Via');
    });
    await act(async () => {
      void result.current.fetchPredictions('Viana');
    });

    expect(getPlacePredictions).toHaveBeenNthCalledWith(
      1,
      'Via',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(getPlacePredictions).toHaveBeenNthCalledWith(
      2,
      'Viana',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await act(async () => {
      resolveSlow([{ place_id: 'nominatim-stale', description: 'Stale', lat: 0, lng: 0 }]);
    });

    await waitFor(() => {
      expect(result.current.suggestions).toEqual([
        { place_id: 'nominatim-2', description: 'Viana, Viana', lat: 1, lng: 2 },
      ]);
    });
  });
});
