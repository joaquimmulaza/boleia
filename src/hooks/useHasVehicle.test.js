import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHasVehicle } from './useHasVehicle';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useHasVehicle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devolve false quando não há veículo', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const { result } = renderHook(() => useHasVehicle('driver-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.hasVehicle).toBe(false);
  });

  it('devolve true quando há veículo', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      }),
    });

    const { result } = renderHook(() => useHasVehicle('driver-1'));

    await waitFor(() => {
      expect(result.current.hasVehicle).toBe(true);
    });
    expect(result.current.error).toBeNull();
  });

  it('devolve error em falha de rede sem marcar hasVehicle como false', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('Network error')),
      }),
    });

    const { result } = renderHook(() => useHasVehicle('driver-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.hasVehicle).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it('retry volta a consultar após erro', async () => {
    const eq = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ data: [{ id: 'vei-1' }], error: null });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({ eq }),
    });

    const { result } = renderHook(() => useHasVehicle('driver-1'));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    await result.current.retry();

    await waitFor(() => {
      expect(result.current.hasVehicle).toBe(true);
    });
    expect(result.current.error).toBeNull();
    expect(eq).toHaveBeenCalledTimes(2);
  });
});
