import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { supabase } from '../lib/supabase';
import { usePushNotifications } from './usePushNotifications';

const mockUnsubscribe = vi.fn();
const ENDPOINT = 'https://push.example/device-abc';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('usePushNotifications — unsubscribe (review B2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(global, 'Notification', {
      value: { permission: 'granted' },
      configurable: true,
    });

    mockUnsubscribe.mockResolvedValue(true);

    const subscription = {
      toJSON: () => ({ endpoint: ENDPOINT, keys: {} }),
      unsubscribe: mockUnsubscribe,
    };

    const pushManager = {
      getSubscription: vi.fn().mockResolvedValue(subscription),
    };

    const registration = { pushManager };

    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve(registration),
      },
      configurable: true,
    });

    Object.defineProperty(global.window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('apaga por user_id + endpoint JSON antes de unsubscribe', async () => {
    const selectFn = vi.fn().mockResolvedValue({ data: [{ id: 'sub-1' }], error: null });
    const eqEndpoint = vi.fn().mockReturnValue({ select: selectFn });
    const eqUser = vi.fn().mockReturnValue({ eq: eqEndpoint });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqUser });
    supabase.from.mockReturnValue({ delete: deleteFn });

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const out = await result.current.unsubscribe('user-99');
      expect(out.success).toBe(true);
    });

    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-99');
    expect(eqEndpoint).toHaveBeenCalledWith('subscription->>endpoint', ENDPOINT);
    expect(selectFn).toHaveBeenCalledWith('id');
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.isSubscribed).toBe(false);
  });

  it('se o DELETE não apagar linhas, ainda faz unsubscribe local com success', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const selectFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqEndpoint = vi.fn().mockReturnValue({ select: selectFn });
    const eqUser = vi.fn().mockReturnValue({ eq: eqEndpoint });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqUser });
    supabase.from.mockReturnValue({ delete: deleteFn });

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const out = await result.current.unsubscribe('user-99');
      expect(out.success).toBe(true);
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(result.current.isSubscribed).toBe(false);
    warnSpy.mockRestore();
  });

  it('se o DELETE falhar, não chama unsubscribe nem marca desactivado', async () => {
    const selectFn = vi.fn().mockResolvedValue({ error: { message: 'RLS', code: '42501' } });
    const eqEndpoint = vi.fn().mockReturnValue({ select: selectFn });
    const eqUser = vi.fn().mockReturnValue({ eq: eqEndpoint });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqUser });
    supabase.from.mockReturnValue({ delete: deleteFn });

    const { result } = renderHook(() => usePushNotifications());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const out = await result.current.unsubscribe('user-99');
      expect(out.error).toBe('RLS');
    });

    expect(mockUnsubscribe).not.toHaveBeenCalled();
    expect(result.current.isSubscribed).toBe(true);
    expect(result.current.actionLoading).toBe(false);
  });
});
