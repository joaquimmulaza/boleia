import React from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Auth from './Auth';

// Mock do módulo Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
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

    // Mudar para modo "Criar Conta"
    const toggleBtn = screen.getByRole('button', { name: /Criar Conta/i });
    fireEvent.click(toggleBtn);

    // Preencher o formulário com telefone inválido
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Usuário Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '123' } });

    // Submeter
    const form = screen.getByLabelText('auth-form');
    fireEvent.submit(form);

    // Deve mostrar mensagem de erro inline
    await waitFor(() => {
      expect(screen.getByText(/Número de telefone inválido/i)).toBeInTheDocument();
      // O erro não deve ser o alerta geral (que tem role="alert")
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    // signUp NÃO deve ter sido chamado
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });

  it('permite o registo com número de telefone válido: 923456789', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste1@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Usuário Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '923456789' } });
    const form = screen.getByLabelText('auth-form');
    fireEvent.submit(form);
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });
  });

  it('permite o registo com número de telefone válido: +244 923 456 789', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste2@exemplo.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Usuário Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '+244 923 456 789' } });
    const form = screen.getByLabelText('auth-form');
    fireEvent.submit(form);
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalled();
    });
  });
});
