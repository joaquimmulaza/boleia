import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Auth from './Auth';

// Mock do módulo Supabase - substitui as funções de auth por vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  },
}));

// Importar o mock DEPOIS do vi.mock para ter acesso às funções mockadas
import { supabase } from '../lib/supabase';

describe('Auth Component', () => {
  beforeEach(() => {
    // Limpar o histórico de chamadas entre testes
    vi.clearAllMocks();
    // Mock por defeito retorna sucesso sem erro
    supabase.auth.signUp.mockResolvedValue({ data: {}, error: null });
    supabase.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null });
  });

  it('renders correctly in Login mode by default', () => {
    render(<Auth />);

    // Check main elements
    expect(screen.getByRole('heading', { name: /Boleia Certa/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Check toggle for profile (Sou Passageiro / Sou Motorista)
    expect(screen.getByRole('radio', { name: /Sou Passageiro/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Sou Motorista/i })).toBeInTheDocument();

    // Main submit button
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();

    // Toggle to Create account
    expect(screen.getByRole('button', { name: /Criar Conta/i })).toBeInTheDocument();
  });

  it('can toggle between Login and Resgisto modes', () => {
    render(<Auth />);

    const toggleModeBtn = screen.getByRole('button', { name: /Criar Conta/i });
    fireEvent.click(toggleModeBtn);

    // Main submit button should say Registo or similar
    expect(screen.getByRole('button', { name: /Registar/i })).toBeInTheDocument();

    // Toggle back to login
    const toggleBackBtn = screen.getByRole('button', { name: /Entrar na minha conta/i });
    fireEvent.click(toggleBackBtn);

    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
  });

  it('can select different profile types', () => {
    render(<Auth />);

    const passengerRadio = screen.getByRole('radio', { name: /Sou Passageiro/i });
    const driverRadio = screen.getByRole('radio', { name: /Sou Motorista/i });

    expect(passengerRadio).toBeChecked();
    expect(driverRadio).not.toBeChecked();

    fireEvent.click(driverRadio);

    expect(passengerRadio).not.toBeChecked();
    expect(driverRadio).toBeChecked();
  });

  it('chama signUp com email, password e user_type ao submeter em modo Criar Conta', async () => {
    render(<Auth />);

    // Mudar para modo "Criar Conta"
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    // Preencher o formulário
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'teste@boleia.co.ao' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' },
    });

    // Submeter o formulário
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    // Verificar que signUp foi chamado com os dados corretos
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'teste@boleia.co.ao',
        password: 'password123',
        options: {
          data: { user_type: 'passageiro' },
        },
      });
    });
  });

  it('chama signInWithPassword com email e password ao submeter em modo Entrar', async () => {
    render(<Auth />);

    // Preencher o formulário (modo "Entrar" é o default)
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'teste@boleia.co.ao' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' },
    });

    // Submeter o formulário
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Verificar que signInWithPassword foi chamado com os dados corretos
    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'teste@boleia.co.ao',
        password: 'password123',
      });
    });
  });
});
