import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
let mockSearch = '';

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: mockSearch }),
}));

import { supabase } from '../lib/supabase';

describe('Auth Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearch = '';
    supabase.auth.signUp.mockResolvedValue({ data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } }, error: null });
    supabase.auth.signInWithPassword.mockResolvedValue({ data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } }, error: null });
    supabase.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    supabase.auth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    mockNavigate.mockClear();
  });

  it('com sessionEnded=1 mostra aviso acima do formulário', () => {
    mockSearch = `?sessionEnded=1&openAcordoId=3f42eca2-03c9-8153-b9ea-c6e621e03656`;
    render(<Auth />);

    expect(
      screen.getByText('A tua sessão terminou. Entra outra vez para continuar.'),
    ).toBeInTheDocument();
  });

  it('sem sessionEnded não mostra aviso de sessão terminada', () => {
    mockSearch = '';
    render(<Auth />);

    expect(
      screen.queryByText('A tua sessão terminou. Entra outra vez para continuar.'),
    ).not.toBeInTheDocument();
  });

  it('renders correctly in Login mode by default', () => {
    render(<Auth />);

    expect(screen.getByRole('heading', { name: /Boleia Certa/i })).toBeInTheDocument();
    expect(screen.getByAltText(/Boleia Certa/i)).toHaveAttribute('src', '/boleia-logo.png');
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Palavra-passe$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar Conta/i })).toBeInTheDocument();
  });

  it('no início de sessão o ícone Boleia Certa liga à página inicial', () => {
    render(<Auth />);

    const home = screen.getByRole('link', { name: /Boleia Certa/i });
    expect(home).toHaveAttribute('href', '/');
    expect(home).toContainElement(screen.getByAltText(/Boleia Certa/i));
  });

  it('em criar conta o ícone Boleia Certa liga à página inicial', () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));

    expect(screen.getByRole('link', { name: /Boleia Certa/i })).toHaveAttribute('href', '/');
  });

  it('recuperar palavra-passe não liga o cabeçalho à página inicial', () => {
    mockSearch = '?mode=forgot';
    render(<Auth />);

    expect(screen.queryByRole('link', { name: /Boleia Certa/i })).not.toBeInTheDocument();
    expect(screen.getByAltText(/Boleia Certa/i)).toBeInTheDocument();
  });

  it('NÃO renderiza o Toggle de Perfil em modo Login', () => {
    render(<Auth />);
    expect(screen.queryByRole('radio', { name: /Sou Passageiro/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /Sou Motorista/i })).not.toBeInTheDocument();
  });

  it('NÃO renderiza campos Nome e Telefone em modo Login', () => {
    render(<Auth />);
    expect(screen.queryByLabelText(/Nome Completo/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Telefone/i)).not.toBeInTheDocument();
  });

  it('renderiza o Toggle de Perfil, Nome e Telefone em modo Criar Conta', () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    expect(screen.getByRole('radio', { name: /Sou Passageiro/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Sou Motorista/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome Completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Telefone/i)).toBeInTheDocument();
  });

  it('can toggle between Login and Registo modes', () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    expect(screen.getByRole('button', { name: /Registar/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Entrar na minha conta/i }));
    expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument();
  });

  it('can select different profile types in Criar Conta mode', () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    const passengerRadio = screen.getByRole('radio', { name: /Sou Passageiro/i });
    const driverRadio = screen.getByRole('radio', { name: /Sou Motorista/i });
    expect(passengerRadio).toBeChecked();
    fireEvent.click(driverRadio);
    expect(driverRadio).toBeChecked();
  });

  it('chama signUp com o payload correto ao submeter em modo Criar Conta', async () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Nome Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '999999999' } });
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'teste@boleia.co.ao',
        password: 'password123',
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
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
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.click(screen.getByRole('radio', { name: /Sou Motorista/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'motorista@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Nome Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '999999999' } });
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    await waitFor(() => {
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'motorista@boleia.co.ao',
        password: 'password123',
        options: {
          emailRedirectTo: `${window.location.origin}/auth`,
          data: {
            tipo_perfil: 'Motorista',
            nome_completo: 'Nome Teste',
            telefone: '999999999',
          },
        },
      });
    });
  });

  const fillRegister = () => {
    fireEvent.click(screen.getByRole('button', { name: /Criar Conta/i }));
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/Nome Completo/i), { target: { value: 'Nome Teste' } });
    fireEvent.change(screen.getByLabelText(/Telefone/i), { target: { value: '999999999' } });
  };

  it('após registo sem sessão fica no ecrã a pedir confirmação do email', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          identities: [{ provider: 'email', id: 'id-email' }],
          confirmation_sent_at: '2026-10-05T12:00:00.000Z',
          user_metadata: { tipo_perfil: 'Passageiro' },
        },
        session: null,
      },
      error: null,
    });

    render(<Auth />);
    fillRegister();
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Verifique o seu email para confirmar a conta/i)).toBeInTheDocument();
    });
    await new Promise((resolve) => { setTimeout(resolve, 1200); });
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Registar/i })).toBeInTheDocument();
  });

  it('registo com email já confirmado (conta Google) pede para entrar e não pede confirmação', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: {
        user: {
          identities: [],
          confirmation_sent_at: '2026-10-05T12:00:00.000Z',
          email_confirmed_at: null,
          app_metadata: { provider: 'email', providers: ['email'] },
          user_metadata: { tipo_perfil: 'Passageiro', nome_completo: 'Nome Teste' },
        },
        session: null,
      },
      error: null,
    });

    render(<Auth />);
    fillRegister();
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/já existe uma conta com este email/i);
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/tenta entrar/i);
    expect(screen.queryByText(/Verifique o seu email/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Entrar na minha conta/i })).toBeInTheDocument();
    await new Promise((resolve) => { setTimeout(resolve, 1200); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('após registo com sessão navega para o hub', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({
      data: {
        user: { user_metadata: { tipo_perfil: 'Motorista' } },
        session: { access_token: 'sessao' },
      },
      error: null,
    });

    render(<Auth />);
    fillRegister();
    fireEvent.click(screen.getByRole('radio', { name: /Sou Motorista/i }));
    fireEvent.click(screen.getByRole('button', { name: /Registar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/motorista');
    }, { timeout: 2000 });
  });

  it('login com email por confirmar explica que falta confirmar e não entra no hub', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    });

    render(<Auth />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'delciofigueiredo@gmail.com' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByText(/Confirme o email antes de entrar/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Ocorreu um erro inesperado/i)).not.toBeInTheDocument();
    await new Promise((resolve) => { setTimeout(resolve, 1200); });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('chama signInWithPassword com email e password ao submeter em modo Entrar', async () => {
    render(<Auth />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'teste@boleia.co.ao',
        password: 'password123',
      });
    });
  });

  it('após login bem-sucedido como Motorista, redireciona para a rota apropriada', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { user_metadata: { tipo_perfil: 'Motorista' } } },
      error: null,
    });

    render(<Auth />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Bem-vindo de volta!')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/motorista');
    }, { timeout: 2000 });
  });

  it('após login com next interno, redireciona para o URL pedido', async () => {
    mockSearch = `?next=${encodeURIComponent('/explorar?origem=Viana&destino=Talatona')}`;
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null,
    });

    render(<Auth />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/explorar?origem=Viana&destino=Talatona');
    }, { timeout: 2000 });
  });

  it('next externo é ignorado e usa hub default', async () => {
    mockSearch = `?next=${encodeURIComponent('https://evil.example/phish')}`;
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null,
    });

    render(<Auth />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/passageiro');
    }, { timeout: 2000 });
  });

  it('após login bem-sucedido como Passageiro, redireciona para a rota principal', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } },
      error: null,
    });

    render(<Auth />);
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'teste@boleia.co.ao' } });
    fireEvent.change(screen.getByLabelText(/^Palavra-passe$/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Bem-vindo de volta!')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/passageiro');
    }, { timeout: 2000 });
  });

  it('CTA Esqueceu a palavra-passe navega para mode=forgot', () => {
    render(<Auth />);
    fireEvent.click(screen.getByRole('button', { name: /Esqueceu a palavra-passe/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=forgot', { replace: true });
  });

  it('modo forgot chama resetPasswordForEmail com redirectTo e mostra sucesso genérico', async () => {
    mockSearch = '?mode=forgot';
    render(<Auth />);

    expect(screen.getByRole('button', { name: /Enviar instruções/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Palavra-passe$/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'user@boleia.co.ao' } });
    fireEvent.click(screen.getByRole('button', { name: /Enviar instruções/i }));

    await waitFor(() => {
      expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('user@boleia.co.ao', {
        redirectTo: expect.stringMatching(/\/auth\?mode=update-password$/),
      });
    });
    expect(screen.getByText(/Se existir conta com este email, enviámos instruções/i)).toBeInTheDocument();
  });

  it('modo update-password valida confirmação antes de updateUser', async () => {
    mockSearch = '?mode=update-password';
    render(<Auth />);

    fireEvent.change(screen.getByLabelText(/Nova palavra-passe/i), { target: { value: 'novaPass12' } });
    fireEvent.change(screen.getByLabelText(/Confirmar palavra-passe/i), { target: { value: 'outraPass' } });
    fireEvent.submit(screen.getByLabelText('auth-form'));

    await waitFor(() => {
      expect(screen.getByText(/As palavras-passe não coincidem/i)).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('modo update-password rejeita palavra-passe com menos de 8 caracteres', async () => {
    mockSearch = '?mode=update-password';
    render(<Auth />);

    fireEvent.change(screen.getByLabelText(/Nova palavra-passe/i), { target: { value: 'curta' } });
    fireEvent.change(screen.getByLabelText(/Confirmar palavra-passe/i), { target: { value: 'curta' } });
    fireEvent.submit(screen.getByLabelText('auth-form'));

    await waitFor(() => {
      expect(screen.getByText(/pelo menos 8 caracteres/i)).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('modo update-password chama updateUser e navega para hub', async () => {
    mockSearch = '?mode=update-password';
    render(<Auth />);

    fireEvent.change(screen.getByLabelText(/Nova palavra-passe/i), { target: { value: 'novaPass12' } });
    fireEvent.change(screen.getByLabelText(/Confirmar palavra-passe/i), { target: { value: 'novaPass12' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar nova palavra-passe/i }));

    await waitFor(() => {
      expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'novaPass12' });
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/passageiro');
    }, { timeout: 2000 });
  });
});
