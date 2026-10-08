import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import {
  acordoPrecisaLiveRefresh,
  useAcordoDetalheLiveRefresh,
  ACORDO_DETALHE_POLL_MS,
} from './useAcordoDetalheLiveRefresh';
import { supabase } from '../lib/supabase';

describe('acordoPrecisaLiveRefresh', () => {
  it('activa com rescisão consensual em curso (activo)', () => {
    expect(
      acordoPrecisaLiveRefresh({
        id: 'a1',
        estado: 'activo',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
      }),
    ).toBe(true);
  });

  it('não activa em cancelamento_pendente', () => {
    expect(
      acordoPrecisaLiveRefresh({
        id: 'a1',
        estado: 'cancelamento_pendente',
      }),
    ).toBe(false);
  });

  it('não activa para acordo cancelado', () => {
    expect(
      acordoPrecisaLiveRefresh({
        id: 'a1',
        estado: 'cancelado',
      }),
    ).toBe(false);
  });
});

describe('useAcordoDetalheLiveRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removeChannel e clearInterval no cleanup', async () => {
    const clearSpy = vi.spyOn(global, 'clearInterval');
    const onRefresh = vi.fn();
    const { unmount } = renderHook(() =>
      useAcordoDetalheLiveRefresh({
        enabled: true,
        userId: 'user-1',
        acordoId: 'acordo-1',
        onRefresh,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    unmount();

    expect(supabase.removeChannel).toHaveBeenCalled();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('não faz tick em cancelamento_pendente (enabled false)', async () => {
    const onRefresh = vi.fn();
    renderHook(() =>
      useAcordoDetalheLiveRefresh({
        enabled: false,
        userId: 'user-1',
        acordoId: 'acordo-1',
        onRefresh,
      }),
    );

    await act(async () => {
      vi.advanceTimersByTime(ACORDO_DETALHE_POLL_MS * 3);
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('pausa interval quando document.hidden', async () => {
    const onRefresh = vi.fn();
    renderHook(() =>
      useAcordoDetalheLiveRefresh({
        enabled: true,
        userId: 'user-1',
        acordoId: 'acordo-1',
        onRefresh,
      }),
    );

    onRefresh.mockClear();

    await act(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(ACORDO_DETALHE_POLL_MS * 2);
    });

    expect(onRefresh).not.toHaveBeenCalled();

    await act(async () => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(ACORDO_DETALHE_POLL_MS);
    });

    expect(onRefresh.mock.calls.length).toBeGreaterThanOrEqual(1);

    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  });
});
