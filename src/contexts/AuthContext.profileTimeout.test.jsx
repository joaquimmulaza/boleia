import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { supabase } from '../lib/supabase';
import { PROFILE_LOAD_TIMEOUT_MS } from '../components/ProfileLoadGate';
import { resetAuthSessionRefreshState } from '../utils/authSessionRefresh.js';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

function Probe() {
  const { profileLoading, profileLoadTimedOut, profile } = useAuth();
  return (
    <div>
      <span data-testid="loading">{profileLoading ? 'sim' : 'nao'}</span>
      <span data-testid="timeout">{profileLoadTimedOut ? 'sim' : 'nao'}</span>
      <span data-testid="profile">{profile?.nome_completo ?? 'vazio'}</span>
    </div>
  );
}

describe('AuthContext — timeout de perfil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAuthSessionRefreshState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('após timeout desliga profileLoading e marca profileLoadTimedOut', async () => {
    const session = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-timeout' },
    };

    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

    let resolveSingle;
    const singlePromise = new Promise((resolve) => {
      resolveSingle = resolve;
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => singlePromise,
        }),
      }),
    });
    supabase.rpc.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('loading')).toHaveTextContent('sim');

    await act(async () => {
      vi.advanceTimersByTime(PROFILE_LOAD_TIMEOUT_MS + 50);
      await Promise.resolve();
    });

    expect(screen.getByTestId('timeout')).toHaveTextContent('sim');

    resolveSingle?.({ data: null, error: { code: 'PGRST116' } });
  });

  it('timeout não invalida fetch — perfil tardio (12s) substitui o erro', async () => {
    const session = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-late' },
    };

    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

    let resolvePerfis;
    let resolveRpc;
    const perfisPromise = new Promise((resolve) => {
      resolvePerfis = resolve;
    });
    const rpcPromise = new Promise((resolve) => {
      resolveRpc = resolve;
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => perfisPromise,
        }),
      }),
    });
    supabase.rpc.mockImplementation(() => rpcPromise);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(PROFILE_LOAD_TIMEOUT_MS + 50);
      await Promise.resolve();
    });

    expect(screen.getByTestId('timeout')).toHaveTextContent('sim');
    expect(screen.getByTestId('profile')).toHaveTextContent('vazio');

    await act(async () => {
      vi.advanceTimersByTime(2500);
      resolvePerfis?.({
        data: { id: 'user-late', nome_completo: 'Maria Tardia', tipo_perfil: 'Passageiro' },
        error: null,
      });
      resolveRpc?.({ data: { telefone: null, iban: null }, error: null });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId('timeout')).toHaveTextContent('nao');
    expect(screen.getByTestId('profile')).toHaveTextContent('Maria Tardia');
    expect(screen.getByTestId('loading')).toHaveTextContent('nao');
  });

  it('após timeout com sessão expirada chama signOut local', async () => {
    const liveSession = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id: 'user-expired-timeout' },
    };
    const expiredSession = {
      ...liveSession,
      expires_at: Math.floor(Date.now() / 1000) - 60,
    };

    supabase.auth.getSession.mockResolvedValue({ data: { session: liveSession }, error: null });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => new Promise(() => {}),
        }),
      }),
    });
    supabase.rpc.mockReturnValue(new Promise(() => {}));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    supabase.auth.getSession.mockResolvedValue({ data: { session: expiredSession }, error: null });

    await act(async () => {
      vi.advanceTimersByTime(PROFILE_LOAD_TIMEOUT_MS + 50);
      await Promise.resolve();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
