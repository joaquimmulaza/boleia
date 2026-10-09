import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import { supabase } from '../lib/supabase';
import { PROFILE_LOAD_TIMEOUT_MS } from '../utils/profileLoadTimeout.js';
import { resetAuthSessionRefreshState } from '../utils/authSessionRefresh.js';

const ACORDO_ID = '3f42eca2-03c9-8153-b9ea-c6e621e03656';

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

vi.mock('../utils/swRuntimeCache', () => ({
  clearSwRuntimeCache: vi.fn(() => Promise.resolve()),
}));

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="loc">
      {location.pathname}
      {location.search}
    </div>
  );
}

function RetryButton() {
  const { retryProfileLoad } = useAuth();
  return (
    <button type="button" onClick={() => retryProfileLoad()}>
      Tentar outra vez
    </button>
  );
}

/** Regressão B1 — ordem profileLoading antes de profileLoadTimedOut (falha em 92604faf). */
describe('AuthContext retryProfileLoad — deep link (B1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAuthSessionRefreshState();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('«Tentar outra vez» mantém /motorista?openAcordoId durante await getSession', async () => {
    const session = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: 'mot-1',
        user_metadata: { tipo_perfil: 'Motorista' },
      },
    };

    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => new Promise(() => {}),
        }),
      }),
    });
    supabase.rpc.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={[`/motorista?openAcordoId=${ACORDO_ID}`]}>
        <AuthProvider>
          <LocationProbe />
          <Routes>
            <Route path="/passageiro" element={<div>Hub Passageiro</div>} />
            <Route path="/motorista" element={<ProtectedRoute allowedRole="Motorista" />}>
              <Route index element={<RetryButton />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(PROFILE_LOAD_TIMEOUT_MS + 50);
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /tentar outra vez/i })).toBeInTheDocument();

    let resolveRetryGetSession;
    const retryGetSessionPromise = new Promise((resolve) => {
      resolveRetryGetSession = resolve;
    });
    supabase.auth.getSession.mockImplementation(() => retryGetSessionPromise);

    await act(async () => {
      screen.getByRole('button', { name: /tentar outra vez/i }).click();
      await Promise.resolve();
    });

    expect(screen.getByTestId('loc')).toHaveTextContent(
      `/motorista?openAcordoId=${ACORDO_ID}`,
    );
    expect(screen.queryByText('Hub Passageiro')).not.toBeInTheDocument();

    await act(async () => {
      resolveRetryGetSession?.({ data: { session }, error: null });
      await Promise.resolve();
    });
  });

  it('92604faf: fetch falha, timeout, «Tentar outra vez» preserva openAcordoId (sem redirect)', async () => {
    const session = {
      access_token: 'tok',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: {
        id: 'mot-metadata-pax',
        user_metadata: { tipo_perfil: 'Passageiro' },
      },
    };

    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });

    let resolvePerfisFail;
    const perfisFailPromise = new Promise((resolve) => {
      resolvePerfisFail = resolve;
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: () => perfisFailPromise,
        }),
      }),
    });
    supabase.rpc.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter initialEntries={[`/motorista?openAcordoId=${ACORDO_ID}`]}>
        <AuthProvider>
          <LocationProbe />
          <Routes>
            <Route path="/passageiro" element={<LocationProbe />} />
            <Route path="/auth" element={<div>Auth</div>} />
            <Route path="/motorista" element={<ProtectedRoute allowedRole="Motorista" />}>
              <Route index element={<RetryButton />} />
            </Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(PROFILE_LOAD_TIMEOUT_MS + 50);
      await Promise.resolve();
    });

    await act(async () => {
      resolvePerfisFail?.({
        data: null,
        error: { code: '42501', message: 'permission denied for table perfis' },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: /tentar outra vez/i })).toBeInTheDocument();

    let resolveRetryGetSession;
    supabase.auth.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRetryGetSession = resolve;
        }),
    );

    await act(async () => {
      screen.getByRole('button', { name: /tentar outra vez/i }).click();
      await Promise.resolve();
    });

    expect(screen.getByTestId('loc').textContent).toMatch(
      new RegExp(`^/motorista\\?openAcordoId=${ACORDO_ID}`),
    );
    expect(screen.getByTestId('loc').textContent).not.toBe('/passageiro');
    expect(screen.queryByText('Auth')).not.toBeInTheDocument();

    await act(async () => {
      resolveRetryGetSession?.({ data: { session }, error: null });
      await Promise.resolve();
    });
  });
});
