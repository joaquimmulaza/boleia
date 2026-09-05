import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useNetworkStatus } from './useNetworkStatus';

describe('useNetworkStatus', () => {
  it('expõe isOffline=false quando online', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOffline).toBe(false);
    expect(result.current.isOnline).toBe(true);
  });

  it('reage a eventos offline/online da Window', () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current.isOffline).toBe(true);

    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current.isOffline).toBe(false);
  });
});
