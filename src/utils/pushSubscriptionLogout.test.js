import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  removeCurrentDevicePushSubscription,
  SW_OPERATION_TIMEOUT_MS,
} from './pushSubscriptionLogout';
import { supabase } from '../lib/supabase';

const ENDPOINT = 'https://push.example/device-logout';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

function mockServiceWorker(getRegistrationImpl) {
  Object.defineProperty(global.navigator, 'serviceWorker', {
    value: { getRegistration: getRegistrationImpl },
    configurable: true,
  });
  Object.defineProperty(global.window, 'PushManager', {
    value: function PushManager() {},
    configurable: true,
  });
}

describe('removeCurrentDevicePushSubscription', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('sem service worker registado devolve success sem DELETE', async () => {
    mockServiceWorker(vi.fn().mockResolvedValue(undefined));

    const out = await removeCurrentDevicePushSubscription('user-1');
    expect(out).toEqual({ success: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('getRegistration pendente demais expira e devolve success (logout não bloqueia)', async () => {
    vi.useFakeTimers();
    mockServiceWorker(() => new Promise(() => {}));

    const pending = removeCurrentDevicePushSubscription('user-1');
    await vi.advanceTimersByTimeAsync(SW_OPERATION_TIMEOUT_MS);
    const out = await pending;

    expect(out).toEqual({ success: true });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('apaga por user_id + endpoint e faz unsubscribe', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = {
      toJSON: () => ({ endpoint: ENDPOINT, keys: {} }),
      unsubscribe: mockUnsubscribe,
    };
    const pushManager = { getSubscription: vi.fn().mockResolvedValue(subscription) };
    mockServiceWorker(vi.fn().mockResolvedValue({ pushManager }));

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

  it('erro de DELETE ainda chama unsubscribe local', async () => {
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const subscription = {
      toJSON: () => ({ endpoint: ENDPOINT }),
      unsubscribe: mockUnsubscribe,
    };
    mockServiceWorker(
      vi.fn().mockResolvedValue({
        pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) },
      }),
    );

    const selectFn = vi.fn().mockResolvedValue({ error: { message: '42501' } });
    const eqEndpoint = vi.fn().mockReturnValue({ select: selectFn });
    const eqUser = vi.fn().mockReturnValue({ eq: eqEndpoint });
    supabase.from.mockReturnValue({ delete: vi.fn().mockReturnValue({ eq: eqUser }) });

    const out = await removeCurrentDevicePushSubscription('user-42');
    expect(out.error).toBe('42501');
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
