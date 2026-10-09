import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import { PERFIL_COLUNAS_AUTH_CONTEXT_SELECT } from '../utils/perfisGrants.js';
import { supabase } from '../lib/supabase';
import { resetAuthSessionRefreshState } from '../utils/authSessionRefresh.js';

/**
 * @param {string} userId
 * @param {{ expiresAtSec?: number, accessToken?: string }} [opts]
 */
function liveSession(userId, opts = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    access_token: opts.accessToken ?? 'test-access-token',
    expires_at: opts.expiresAtSec ?? nowSec - 60,
    user: { id: userId, user_metadata: { tipo_perfil: 'Passageiro' } },
  };
}

const mockSingle = vi.fn();
const mockEq = vi.fn(() => ({ single: mockSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      onAuthStateChange: vi.fn(),
    },
    from: vi.fn(() => ({
      select: mockSelect,
    })),
    rpc: vi.fn(),
  },
}));

vi.mock('../utils/swRuntimeCache', () => ({
  clearSwRuntimeCache: vi.fn(() => Promise.resolve()),
}));

const TestProfile = () => {
  const { profile, profileLoading } = useAuth();
  return (
    <div>
      <div data-testid="loading">{profileLoading ? 'sim' : 'nao'}</div>
      <div data-testid="nome">{profile?.nome_completo ?? 'sem-perfil'}</div>
    </div>
  );
};

describe('AuthContext fetchProfile — retry e concorrência', () => {
  beforeEach(() => {
    resetAuthSessionRefreshState();
    vi.clearAllMocks();
    mockSingle.mockReset();
    mockSelect.mockReset();
    mockEq.mockReset();
    mockEq.mockImplementation(() => ({ single: mockSingle }));
    mockSelect.mockImplementation(() => ({ eq: mockEq }));
    supabase.auth.getSession.mockReset();
    supabase.auth.refreshSession.mockReset();
    supabase.rpc.mockReset();
    supabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('retry com refresh bem-sucedido carrega perfil na segunda carga', async () => {
    const refreshed = liveSession('user-retry', {
      accessToken: 'refreshed-token',
      expiresAtSec: Math.floor(Date.now() / 1000) + 3600,
    });

    supabase.auth.getSession.mockImplementation(async () => ({
      data: { session: refreshed },
      error: null,
    }));
    supabase.auth.refreshSession.mockImplementation(async () => {
      return { data: { session: refreshed }, error: null };
    });

    mockSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'permission denied for table perfis', status: 401 },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'user-retry',
          nome_completo: 'Ana Retry',
          tipo_perfil: 'Passageiro',
          onboarding_completed: true,
          perfil_completo: true,
        },
        error: null,
      });

    supabase.rpc
      .mockResolvedValueOnce({ data: null, error: { status: 401, code: '42501' } })
      .mockResolvedValueOnce({ data: { telefone: '+244900000001', iban: null }, error: null });

    render(
      <AuthProvider>
        <TestProfile />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('nome')).toHaveTextContent('Ana Retry');
    });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(mockSelect).toHaveBeenCalledWith(PERFIL_COLUNAS_AUTH_CONTEXT_SELECT);
  });

  it('falha de refreshSession não relança refresh em loop', async () => {
    const session = liveSession('user-fail');
    supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null });
    supabase.auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh failed' },
    });

    mockSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', status: 401, message: 'permission denied for table perfis' },
    });
    supabase.rpc.mockResolvedValue({ data: null, error: { status: 401 } });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <AuthProvider>
        <TestProfile />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('nao');
    });

    expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('nome')).toHaveTextContent('sem-perfil');
    warnSpy.mockRestore();
  });

  it('fetch antigo não sobrescreve perfil após troca de sessão a meio', async () => {
    const sessionA = liveSession('user-a', {
      expiresAtSec: Math.floor(Date.now() / 1000) + 3600,
    });
    let resolveSlow;
    const slowPerfis = new Promise((resolve) => {
      resolveSlow = resolve;
    });

    supabase.auth.getSession.mockResolvedValue({ data: { session: sessionA }, error: null });
    mockSingle.mockImplementation(() => slowPerfis);
    supabase.rpc.mockResolvedValue({ data: { telefone: null, iban: null }, error: null });

    let authChangeListener;
    supabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authChangeListener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    render(
      <AuthProvider>
        <TestProfile />
      </AuthProvider>,
    );

    const sessionB = liveSession('user-b', {
      accessToken: 'token-b',
      expiresAtSec: Math.floor(Date.now() / 1000) + 3600,
    });

    mockSingle.mockImplementation(() =>
      Promise.resolve({
        data: {
          id: 'user-b',
          nome_completo: 'Bruno Actual',
          tipo_perfil: 'Motorista',
          onboarding_completed: false,
          perfil_completo: true,
        },
        error: null,
      }),
    );
    supabase.auth.getSession.mockResolvedValue({ data: { session: sessionB }, error: null });

    await act(async () => {
      authChangeListener('SIGNED_IN', sessionB);
      await new Promise((r) => setTimeout(r, 0));
    });

    await waitFor(() => {
      expect(screen.getByTestId('nome')).toHaveTextContent('Bruno Actual');
    });

    resolveSlow({
      data: {
        id: 'user-a',
        nome_completo: 'Antigo A',
        tipo_perfil: 'Passageiro',
        onboarding_completed: true,
        perfil_completo: true,
      },
      error: null,
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId('nome')).toHaveTextContent('Bruno Actual');
  });
});
