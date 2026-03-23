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

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
}));

// Importar o mock DEPOIS do vi.mock para ter acesso às funções mockadas
import { supabase } from '../lib/supabase';

describe('Auth Component', () => {
  beforeEach(() => {
    // Limpar o histórico de chamadas entre testes
    vi.clearAllMocks();
    // Mock por defeito retorna sucesso sem erro
    supabase.auth.signUp.mockResolvedValue({ data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } }, error: null });
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } }, error: null });
    mockNavigate.mockClear();
  });

  it('renders correctly in Login mode by default', () => {
    render(<Auth />);

    // Check main elements
    expect(screen.getByRole('heading', { name: /Boleia Certa/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();

    // Main submit button
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();

    // Toggle to Create account
    expect(screen.getByRole('button', { name: /Criar Conta/i })).toBeInTheDocument();
  });

  it('NÃO renderiza o Toggle de Perfil em modo Login', () => {
    render(<Auth />);

    // Em modo Login, os radio buttons de perfil NÃO devem estar presentes
    expect(screen.queryByRole('radio', { name: /Sou Passageiro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Sou Motorista/i })).not.toBeInTheDocument();
  });

  it('NÃO renderiza campos Nome e Telefone em modo Login', () => {
    render(<Auth />);

    // Em modo Login, estes campos NÃO devem estar presentes
    expect(screen.queryByLabelText(/Nome Completo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Telefone/i)).not.toBeInTheDocument();
  });

  it('renderiza o Toggle de Perfil, Nome e Telefone em modo Criar Conta', () => {
    render(<Auth />);

    // Mudar para modo Criar Conta
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    // Em modo Criar Conta, o toggle e os campos devem estar presentes
    expect(screen.getByRole('radio', { name: /Sou Passageiro/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Sou Motorista/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone/i)).toBeInTheDocument();
  });

  it('can toggle between Login and Registo modes', () => {
    render(<Auth />);

    const toggleModeBtn = screen.getByRole('button', { name: /Criar Conta/i });
    fireEvent.click(toggleModeBtn);

    // Main submit button should say Registar
    expect(screen.getByRole('button', { name: /Registar/i })).toBeInTheDocument();

    // Toggle back to login
    const toggleBackBtn = screen.getByRole('button', { name: /Entrar na minha conta/i });
    fireEvent.click(toggleBackBtn);

    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
  });

  it('can select different profile types in Criar Conta mode', () => {
    render(<Auth />);

    // Mudar para modo Criar Conta para ver os radio buttons
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    const passengerRadio = screen.getByRole('radio', { name: /Sou Passageiro/i });
    const driverRadio = screen.getByRole('radio', { name: /Sou Motorista/i });

    expect(passengerRadio).toBeChecked();
    expect(driverRadio).not.toBeChecked();

    fireEvent.click(driverRadio);

    expect(passengerRadio).not.toBeChecked();
    expect(driverRadio).toBeChecked();
  });

  it('chama signUp com o payload correto (tipo_perfil, nome_completo, telefone) ao submeter em modo Criar Conta', async () => {
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
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Nome Teste' },
    });
    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: '999999999' },
    });

    // Submeter o formulário (perfil padrão é Passageiro)
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    // Verificar que signUp foi chamado com o payload correto
    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledTimes(1);
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'teste@boleia.co.ao',
        password: 'password123',
        options: {
          data: {
            tipo_perfil: 'Passageiro',
            nome_completo: 'Nome Teste',
            telefone: '999999999',
          },
        },
      });
    });
  });

  it('chama signUp com tipo_perfil Motorista quando o toggle Motorista está selecionado', async () => {
    render(<Auth />);

    // Mudar para modo "Criar Conta"
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    // Selecionar Motorista
    fireEvent.click(screen.getByRole('radio', { name: /Sou Motorista/i }));

    // Preencher o formulário
    fireEvent.change(screen.getByLabelText(/Email/i), {
      target: { value: 'motorista@boleia.co.ao' },
    });
    fireEvent.change(screen.getByLabelText(/Password/i), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
      target: { value: 'Nome Teste' },
    });
    fireEvent.change(screen.getByLabelText(/Telefone/i), {
      target: { value: '999999999' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'motorista@boleia.co.ao',
        password: 'password123',
        options: {
          data: {
            tipo_perfil: 'Motorista',
            nome_completo: 'Nome Teste',
            telefone: '999999999',
          },
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

  it('após login bem-sucedido como Motorista, redireciona para a rota apropriada', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { user_metadata: { tipo_perfil: 'Motorista' } } },
      error: null
    });

    render(<Auth />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Aguardar feedback de sucesso na interface
    await waitFor(() => {
      expect(screen.getByText('Bem-vindo de volta!')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/motorista');
    }, { timeout: 2000 });
  });

  it('após login bem-sucedido como Passageiro, redireciona para a rota principal', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null
    });

    render(<Auth />);
    
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    // Aguardar feedback de sucesso na interface
    await waitFor(() => {
      expect(screen.getByText('Bem-vindo de volta!')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/passageiro');
    }, { timeout: 2000 });
  });
});
