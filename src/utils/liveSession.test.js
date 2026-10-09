import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withLiveSessionAuthCall, ensureLiveSession } from './liveSession.js';
import { resetAuthSessionRefreshState } from './authSessionRefresh.js';

function makeSession(expiresAt) {
  return {
    access_token: 'tok-old',
    expires_at: expiresAt,
    user: { id: 'user-1' },
  };
}

describe('liveSession', () => {
  beforeEach(() => {
    resetAuthSessionRefreshState();
    vi.clearAllMocks();
  });

  it('token expirado: refresh uma vez e a segunda chamada tem sucesso', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = { ...makeSession(now - 120), access_token: 'tok-expired' };
    const fresh = { ...makeSession(now + 3600), access_token: 'tok-fresh' };

    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValueOnce({ data: { session: expired }, error: null })
          .mockResolvedValue({ data: { session: fresh }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: fresh },
          error: null,
        }),
      },
    };

    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '42501', status: 401 } })
      .mockResolvedValueOnce({ data: 'ok', error: null });

    const result = await withLiveSessionAuthCall(client, run);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'ok', error: null });
  });

  it('42501 após refresh proactivo repete run sem segundo refresh', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = { ...makeSession(now - 120), access_token: 'tok-a' };
    const fresh = { ...makeSession(now + 3600), access_token: 'tok-b' };

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: expired }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: fresh },
          error: null,
        }),
      },
    };

    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '42501' } })
      .mockResolvedValueOnce({ data: 'ok', error: null });

    const result = await withLiveSessionAuthCall(client, run);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: 'ok', error: null });
  });

  it('refresh falha: não repete refresh (≤1 refreshSession)', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = makeSession(now - 60);

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: expired }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: 'invalid refresh' },
        }),
      },
    };

    const run = vi.fn().mockResolvedValue({ data: null, error: { code: '42501' } });

    await withLiveSessionAuthCall(client, run);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('ensureLiveSession refresca proactivamente quando expirado', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = makeSession(now - 10);
    const fresh = makeSession(now + 3600);

    const client = {
      auth: {
        getSession: vi
          .fn()
          .mockResolvedValueOnce({ data: { session: expired }, error: null })
          .mockResolvedValue({ data: { session: fresh }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: { ...fresh, access_token: 'tok-refreshed' } },
          error: null,
        }),
      },
    };

    const session = await ensureLiveSession(client);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(session?.access_token).toBe('tok-refreshed');
  });
});
