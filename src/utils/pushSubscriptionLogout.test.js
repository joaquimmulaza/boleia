import { describe, it, expect, vi, beforeEach } from 'vitest';
import { removeCurrentDevicePushSubscription } from './pushSubscriptionLogout';
import { supabase } from '../lib/supabase';

const ENDPOINT = 'https://push.example/device-logout';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('removeCurrentDevicePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sem PushManager devolve success sem side-effects', async () => {
    const prev = global.window.PushManager;
    // @ts-expect-error test env
    delete global.window.PushManager;

    const out = await removeCurrentDevicePushSubscription('user-1');
    expect(out).toEqual({ success: true });
    expect(supabase.from).not.toHaveBeenCalled();

    global.window.PushManager = prev;
  });

  it('apaga por user_id + endpoint e faz unsubscribe antes de signOut', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = {
      toJSON: () => ({ endpoint: ENDPOINT, keys: {} }),
      unsubscribe: mockUnsubscribe,
    };
    const pushManager = { getSubscription: vi.fn().mockResolvedValue(subscription) };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: { ready: Promise.resolve({ pushManager }) },
      configurable: true,
    });
    Object.defineProperty(global.window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });

    const selectFn = vi.fn().mockResolvedValue({ data: [{ id: 'row-1' }], error: null });
    const eqEndpoint = vi.fn().mockReturnValue({ select: selectFn });
    const eqUser = vi.fn().mockReturnValue({ eq: eqEndpoint });
    const deleteFn = vi.fn().mockReturnValue({ eq: eqUser });
    supabase.from.mockReturnValue({ delete: deleteFn });

    const out = await removeCurrentDevicePushSubscription('user-42');
    expect(out.success).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('push_subscriptions');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-42');
    expect(eqEndpoint).toHaveBeenCalledWith('subscription->>endpoint', ENDPOINT);
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('propaga erro de DELETE e não faz unsubscribe', async () => {
    const mockUnsubscribe = vi.fn();
    const subscription = {
      toJSON: () => ({ endpoint: ENDPOINT }),
      unsubscribe: mockUnsubscribe,
    };
    Object.defineProperty(global.navigator, 'serviceWorker', {
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
        }),
      },
      configurable: true,
    });
    Object.defineProperty(global.window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });

    const selectFn = vi.fn().mockResolvedValue({ error: { message: '42501' } });
    const eqEndpoint = vi.fn().mockReturnValue({ select: selectFn });
    const eqUser = vi.fn().mockReturnValue({ eq: eqEndpoint });
    supabase.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqUser }) });

    const out = await removeCurrentDevicePushSubscription('user-42');
    expect(out.error).toBe('42501');
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });
});
