import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  withLiveSessionAuthCall,
  refreshSessionOnceIfAllowed,
  resetAuthSessionRefreshState,
  AUTH_REFRESH_COOLDOWN_MS,
  AUTH_REFRESH_ATTEMPT_KEYS_MAX,
} from './authSessionRefresh.js';
import { profileFetchSessionKey } from './authProfileFetch.js';

function makeSession(expiresAt, accessToken = 'tok-old') {
  return {
    access_token: accessToken,
    expires_at: expiresAt,
    user: { id: 'user-1' },
  };
}

describe('authSessionRefresh — caminho único #255', () => {
  beforeEach(() => {
    resetAuthSessionRefreshState();
    vi.clearAllMocks();
  });

  it('refreshSessionOnceIfAllowed usa chave user.id:access_token', async () => {
    const session = makeSession(Math.floor(Date.now() / 1000) + 3600, 'tok-a');
    expect(profileFetchSessionKey(session)).toBe('user-1:tok-a');

    const client = {
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: { ...session, access_token: 'tok-b' } },
          error: null,
        }),
      },
    };

    await refreshSessionOnceIfAllowed(client, session);
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);

    await refreshSessionOnceIfAllowed(client, session);
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('cooldown 60s bloqueia segundo refresh para o mesmo utilizador', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const session = makeSession(Math.floor(1_000_000 / 1000) + 3600, 'tok-x');
    const client = {
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: { ...session, access_token: 'tok-y' } },
          error: null,
        }),
      },
    };

    await refreshSessionOnceIfAllowed(client, session);
    const session2 = makeSession(Math.floor(1_000_000 / 1000) + 3600, 'tok-z');
    await refreshSessionOnceIfAllowed(client, session2);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(AUTH_REFRESH_COOLDOWN_MS).toBe(60_000);
    vi.spyOn(Date, 'now').mockRestore();
  });

  it('apply_due e perfil partilham o mesmo refresh — segunda operação não refresca de novo', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = makeSession(now - 120, 'tok-shared');

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: expired }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({
          data: {
            session: makeSession(now + 3600, 'tok-shared-new'),
          },
          error: null,
        }),
      },
    };

    const runA = vi.fn().mockResolvedValue({ data: 0, error: null });
    const runB = vi.fn().mockResolvedValue({ data: 0, error: null });

    await withLiveSessionAuthCall(client, runA);
    await withLiveSessionAuthCall(client, runB);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
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

  it('42501 com token válido (não expirado) não chama refreshSession', async () => {
    const now = Math.floor(Date.now() / 1000);
    const fresh = makeSession(now + 3600, 'tok-fresh-valid');

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: fresh }, error: null }),
        refreshSession: vi.fn(),
      },
    };

    const run = vi.fn().mockResolvedValue({ data: null, error: { code: '42501', status: 401 } });

    const result = await withLiveSessionAuthCall(client, run);

    expect(client.auth.refreshSession).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ data: null, error: { code: '42501', status: 401 } });
  });

  it('resetAuthSessionRefreshState limpa tentativas e permite novo refresh', async () => {
    const session = makeSession(Math.floor(Date.now() / 1000) + 3600, 'tok-reset');
    const client = {
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: { ...session, access_token: 'tok-new' } },
          error: null,
        }),
      },
    };

    await refreshSessionOnceIfAllowed(client, session);
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);

    await refreshSessionOnceIfAllowed(client, session);
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);

    resetAuthSessionRefreshState();

    await refreshSessionOnceIfAllowed(client, session);
    expect(client.auth.refreshSession).toHaveBeenCalledTimes(2);
  });

  it('cap do Set de tentativas: após limite global permite nova tentativa', async () => {
    let nowMs = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => nowMs);

    const nowSec = Math.floor(nowMs / 1000);
    const client = {
      auth: {
        refreshSession: vi.fn().mockResolvedValue({
          data: {
            session: makeSession(nowSec + 3600, 'tok-cap-ok'),
          },
          error: null,
        }),
      },
    };

    for (let i = 0; i < AUTH_REFRESH_ATTEMPT_KEYS_MAX; i += 1) {
      nowMs += AUTH_REFRESH_COOLDOWN_MS + 1;
      const s = makeSession(Math.floor(nowMs / 1000) + 3600, `tok-cap-${i}`);
      await refreshSessionOnceIfAllowed(client, s);
    }

    const callsBefore = client.auth.refreshSession.mock.calls.length;
    nowMs += AUTH_REFRESH_COOLDOWN_MS + 1;
    const extra = makeSession(Math.floor(nowMs / 1000) + 3600, 'tok-cap-extra');
    await refreshSessionOnceIfAllowed(client, extra);

    expect(client.auth.refreshSession.mock.calls.length).toBeGreaterThan(callsBefore);
    vi.spyOn(Date, 'now').mockRestore();
  });

  it('em cooldown repete run sem refresh se o token já foi renovado noutra chamada', async () => {
    const now = Math.floor(Date.now() / 1000);
    const expired = makeSession(now - 120, 'tok-shared-old');
    const fresh = makeSession(now + 3600, 'tok-shared-new');

    let sessionState = expired;
    const client = {
      auth: {
        getSession: vi.fn().mockImplementation(async () => ({
          data: { session: sessionState },
          error: null,
        })),
        refreshSession: vi.fn().mockImplementation(async () => {
          sessionState = fresh;
          return { data: { session: fresh }, error: null };
        }),
      },
    };

    const runA = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '42501' } })
      .mockResolvedValueOnce({ data: 'a', error: null });
    const runB = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: '42501' } })
      .mockResolvedValueOnce({ data: 'b', error: null });

    const [resultA, resultB] = await Promise.all([
      withLiveSessionAuthCall(client, runA),
      withLiveSessionAuthCall(client, runB),
    ]);

    expect(client.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(runA).toHaveBeenCalledTimes(2);
    expect(runB).toHaveBeenCalledTimes(2);
    expect(resultA).toEqual({ data: 'a', error: null });
    expect(resultB).toEqual({ data: 'b', error: null });
  });

  it('PGRST301 com token válido tenta refresh uma vez', async () => {
    const now = Math.floor(Date.now() / 1000);
    const fresh = makeSession(now + 3600, 'tok-jwt');

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: fresh }, error: null }),
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: makeSession(now + 7200, 'tok-jwt-new') },
          error: null,
        }),
      },
    };

    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST301' } })
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
});
