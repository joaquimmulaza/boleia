import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Auth from './Auth';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    clearPasswordRecovery: vi.fn(),
    tipoPerfil: null,
    passwordRecoveryPending: false,
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '' }),
}));

import { supabase } from '../lib/supabase';

describe('Auth Validation Fix Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.signUp.mockResolvedValue({ data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it('impede o registo com número de telefone inválido e mostra erro inline', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Usuário Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '123' } });
    fireEvent.submit(screen.getByLabelText('auth-form'));

    await waitFor(() => {
      expect(screen.getByText(/Número de telefone inválido/i)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('permite o registo com número de telefone válido: 923456789', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste1@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Usuário Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '923456789' } });
    fireEvent.submit(screen.getByLabelText('auth-form'));
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });
  });

  it('permite o registo com número de telefone válido: +244 923 456 789', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste2@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Usuário Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '+244 923 456 789' } });
    fireEvent.submit(screen.getByLabelText('auth-form'));
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });
  });
});
