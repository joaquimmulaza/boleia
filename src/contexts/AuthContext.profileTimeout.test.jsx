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
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

function Probe() {
  const { profileLoading, profileLoadTimedOut } = useAuth();
  return (
    <div>
      <span data-testid="loading">{profileLoading ? 'sim' : 'nao'}</span>
      <span data-testid="timeout">{profileLoadTimedOut ? 'sim' : 'nao'}</span>
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
    expect(screen.getByTestId('loading')).toHaveTextContent('nao');

    resolveSingle?.({ data: null, error: { code: 'PGRST116' } });
  });
});
