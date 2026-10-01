import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePwaInstall } from './usePwaInstall';

describe('usePwaInstall', () => {
  /** @type {EventListener[]} */
  let beforeInstallListeners;

  beforeEach(() => {
    beforeInstallListeners = [];
    localStorage.clear();
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    Object.defineProperty(window.navigator, 'standalone', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0.0.0 Mobile Safari/537.36',
    });

    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'beforeinstallprompt') {
        beforeInstallListeners.push(listener);
      }
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'beforeinstallprompt') {
        beforeInstallListeners = beforeInstallListeners.filter((l) => l !== listener);
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('inicia sem instalação nativa disponível', () => {
    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.canInstallNative).toBe(false);
    expect(result.current.isInstalled).toBe(false);
  });

  it('activa canInstallNative quando beforeinstallprompt dispara', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    act(() => {
      beforeInstallListeners.forEach((listener) => listener(mockEvent));
    });

    await waitFor(() => {
      expect(result.current.canInstallNative).toBe(true);
    });
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it('promptInstall chama prompt e devolve outcome', async () => {
    const { result } = renderHook(() => usePwaInstall());

    const mockEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' }),
    };

    act(() => {
      beforeInstallListeners.forEach((listener) => listener(mockEvent));
    });

    await waitFor(() => expect(result.current.canInstallNative).toBe(true));

    let outcome;
    await act(async () => {
      outcome = await result.current.promptInstall();
    });

    expect(mockEvent.prompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
  });

  it('needsInstructions é true no iOS sem prompt nativo', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    });

    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.needsInstructions).toBe(true);
    expect(result.current.platform).toBe('ios');
  });

  it('isInstalled true em modo standalone', () => {
    vi.stubGlobal('matchMedia', vi.fn((query) => ({ matches: query.includes('standalone') })));

    const { result } = renderHook(() => usePwaInstall());
    expect(result.current.isInstalled).toBe(true);
    expect(result.current.canInstallNative).toBe(false);
  });
});
