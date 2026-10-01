import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Auth from './Auth';
import { OAUTH_PENDING_KEY, OAUTH_PROVIDER_KEY } from '../utils/oauth';

const authState = {
  session: null,
  user: null,
  profile: null,
  loading: false,
  profileLoading: false,
  tipoPerfil: null,
  passwordRecoveryPending: false,
  clearPasswordRecovery: vi.fn(),
  refreshProfile: vi.fn(),
};

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => authState,
}));

const mockNavigate = vi.fn();
let mockSearch = '';

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockSearch, pathname: '/auth', hash: '' }),
}));

import { supabase } from '../lib/supabase';

describe('Auth OAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = '';
    sessionStorage.clear();
    authState.session = null;
    authState.user = null;
    authState.profile = null;
    authState.loading = false;
    authState.profileLoading = false;
    authState.tipoPerfil = null;
    authState.passwordRecoveryPending = false;
    supabase.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://idp.example' }, error: null });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null,
    });
    supabase.auth.signUp.mockResolvedValue({
      data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null,
    });
    supabase.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    supabase.auth.signOut.mockResolvedValue({ error: null });
  });

  it('mostra os quatro botões e mantém o login por palavra-passe', async () => {
    render(<Auth />);
    expect(screen.getByRole('button', { name: 'Continuar com Google' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com Apple' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com Facebook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar com LinkedIn' })).toBeInTheDocument();
    expect(screen.getByText('ou')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'ana@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByLabelText('auth-form'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'ana@exemplo.com',
        password: 'password123',
      });
    });
  });

  it('no login, Google não envia papel', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com Google' }));
    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    });
    const call = supabase.auth.signInWithOAuth.mock.calls[0][0];
    expect(call.provider).toBe('google');
    expect(call.options.data).toBeUndefined();
    expect(call.options.redirectTo).toMatch(/\/auth$/);
    expect(screen.getByRole('button', { name: 'A ligar ao Google...' })).toBeDisabled();
  });

  it('no registo, Apple recebe o papel escolhido', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.click(screen.getByRole('radio', { name: /Sou Motorista/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com Apple' }));
    await waitFor(() => {
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
        provider: 'apple',
        options: expect.objectContaining({
          data: { tipo_perfil: 'Motorista' },
        }),
      }));
    });
  });

  it('ignora o segundo clique enquanto o primeiro pedido está aberto', async () => {
    let resolveCall;
    supabase.auth.signInWithOAuth.mockImplementation(() => new Promise((resolve) => {
      resolveCall = resolve;
    }));
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com Facebook' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com LinkedIn' }));
    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledTimes(1);
    resolveCall({ data: { url: 'https://idp.example' }, error: null });
  });

  it('mostra cancelamento e não revela a descrição técnica', async () => {
    sessionStorage.setItem(OAUTH_PROVIDER_KEY, 'google');
    mockSearch = '?error=access_denied&error_description=token-secreto';
    render(<Auth />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cancelaste o início de sessão com Google.');
    expect(screen.queryByText(/token-secreto/)).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/auth', { replace: true });
  });

  it('mostra state inválido', async () => {
    mockSearch = '?error=bad_oauth_state';
    render(<Auth />);
    expect(await screen.findByRole('alert')).toHaveTextContent('A sessão de início de sessão expirou. Tenta novamente.');
  });

  it('restaura os botões quando o provider falha de imediato', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'provider disabled' },
    });
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar com LinkedIn' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar sessão com LinkedIn. Tenta novamente.');
    expect(screen.getByRole('button', { name: 'Continuar com LinkedIn' })).toBeEnabled();
    expect(sessionStorage.getItem(OAUTH_PENDING_KEY)).toBeNull();
  });

  it('conta nova com perfil incompleto vai para completar perfil', async () => {
    authState.session = { user: { id: 'u1' } };
    authState.user = { id: 'u1', email: 'ana@exemplo.com' };
    authState.profile = { perfil_completo: false };
    authState.profileLoading = false;
    sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
    mockSearch = '?code=abc';
    render(<Auth />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=completar-perfil', { replace: true });
    });
  });

  it('conta existente com perfil completo vai para o hub', async () => {
    authState.session = { user: { id: 'u1' } };
    authState.profile = { perfil_completo: true, tipo_perfil: 'Passageiro' };
    authState.tipoPerfil = 'Passageiro';
    sessionStorage.setItem(OAUTH_PENDING_KEY, '1');
    mockSearch = '?code=abc';
    render(<Auth />);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/passageiro', { replace: true });
    });
  });

  it('completar perfil pede telefone, pré-preenche o nome e grava o perfil', async () => {
    mockSearch = '?mode=completar-perfil';
    authState.session = { user: { id: 'u1' } };
    authState.user = {
      id: 'u1',
      email: null,
      user_metadata: { full_name: 'Ana Dias' },
    };
    authState.profile = { perfil_completo: false, nome_completo: 'Ana Dias' };
    const eq = vi.fn().mockResolvedValue({ error: null });
    supabase.from.mockReturnValue({ update: vi.fn(() => ({ eq })) });

    render(<Auth />);
    expect(await screen.findByDisplayValue('Ana Dias')).toBeInTheDocument();
    expect(screen.getByText(/não partilhou um email/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Palavra-passe$/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '+244923456789' } });
    fireEvent.click(screen.getByRole('radio', { name: /Sou Passageiro/i }));
    fireEvent.submit(screen.getByLabelText('auth-form'));

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('perfis');
      expect(eq).toHaveBeenCalledWith('id', 'u1');
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        nome_completo: 'Ana Dias',
        telefone: '+244923456789',
        tipo_perfil: 'Passageiro',
      },
    });
  });
});
