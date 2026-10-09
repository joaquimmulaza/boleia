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

describe('AuthContext retryProfileLoad — deep link', () => {
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
});
