import { render, screen, act, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import { ThemeProvider } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';

// Mock do supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
    from: vi.fn(),
  },
}));

const removeCurrentDevicePushSubscription = vi.fn().mockResolvedValue({ success: true });
vi.mock('../utils/pushSubscriptionLogout', () => ({
  removeCurrentDevicePushSubscription: (...args) => removeCurrentDevicePushSubscription(...args),
}));

import * as AuthContextModule from '../contexts/AuthContext';
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const { useAuth } = AuthContextModule;

// Mock window.matchMedia
const originalMatchMedia = window.matchMedia;

const renderWithRouterAndTheme = (ui, { route = '/' } = {}) => {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route element={ui}>
            <Route path="/" element={<div data-testid="child-content">Child Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
};

describe('Layout Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renderiza o conteúdo filho (Outlet) e o botão de Logout', async () => {
    useAuth.mockReturnValue({ tipoPerfil: null });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /terminar sessão/i })).toBeInTheDocument();
  });

  it('mostra navegação de Passageiro (Início, Acordos, Faltas, Perfil) quando tipo_perfil é Passageiro', async () => {
    useAuth.mockReturnValue({ tipoPerfil: 'Passageiro' });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Acordos')).toBeInTheDocument();
    expect(screen.getByText('Faltas')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
    expect(screen.queryByText('Veículo')).not.toBeInTheDocument(); // Exclusivo de Motorista
  });

  it('mostra navegação de Motorista (Início, Veículo, Acordos, Faltas, Perfil) quando tipo_perfil é Motorista', async () => {
    useAuth.mockReturnValue({ tipoPerfil: 'Motorista' });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    expect(screen.getByText('Início')).toBeInTheDocument();
    expect(screen.getByText('Veículo')).toBeInTheDocument();
    expect(screen.getByText('Acordos')).toBeInTheDocument();
    expect(screen.getByText('Faltas')).toBeInTheDocument();
    expect(screen.getByText('Perfil')).toBeInTheDocument();
  });

  it('mostra a navegação de Passageiro por defeito quando não há sessão', async () => {
    useAuth.mockReturnValue({ tipoPerfil: null });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    expect(screen.queryByText('Veículo')).not.toBeInTheDocument();
    expect(screen.getByText('Início')).toBeInTheDocument();
  });

  it('renderiza o logótipo oficial boleia-logo.png', async () => {
    useAuth.mockReturnValue({ tipoPerfil: null });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    const lockup = screen.getByTestId('brand-lockup');
    const logo = lockup.querySelector('img');
    expect(logo).toHaveAttribute('src', '/boleia-logo.png');
    expect(logo).toHaveAttribute('alt', 'Boleia Certa');
    expect(lockup).not.toHaveTextContent('Boleia Certa');
    expect(lockup.closest('a')).toHaveAttribute('href', '/passageiro');
    expect(screen.getByRole('heading', { name: 'Boleia Certa' })).toBeInTheDocument();
  });

  it('o logótipo do motorista abre o início do motorista e não mostra a palavra', async () => {
    useAuth.mockReturnValue({ tipoPerfil: 'Motorista' });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    const lockup = screen.getByTestId('brand-lockup');
    expect(lockup).not.toHaveTextContent('Boleia Certa');
    expect(lockup.closest('a')).toHaveAttribute('href', '/motorista');
  });

  it('no ecrã de Faltas o cabeçalho fica só com o ícone', async () => {
    useAuth.mockReturnValue({ tipoPerfil: 'Passageiro' });

    await act(async () => {
      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/faltas']}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/faltas" element={<div>Faltas</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ThemeProvider>,
      );
    });

    const lockup = screen.getByTestId('brand-lockup');
    expect(lockup.querySelector('img')).toHaveAttribute('src', '/boleia-logo.png');
    expect(lockup).not.toHaveTextContent('Boleia Certa');
    expect(lockup.closest('a')).toHaveAttribute('href', '/passageiro');
  });

  it('terminar sessão limpa push do dispositivo antes de signOut', async () => {
    useAuth.mockReturnValue({ tipoPerfil: 'Passageiro', user: { id: 'user-logout-1' } });
    supabase.auth.signOut.mockResolvedValue({ error: null });
    removeCurrentDevicePushSubscription.mockClear();

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /terminar sessão/i }));
    });

    expect(removeCurrentDevicePushSubscription).toHaveBeenCalledWith('user-logout-1');
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(removeCurrentDevicePushSubscription.mock.invocationCallOrder[0]).toBeLessThan(
      supabase.auth.signOut.mock.invocationCallOrder[0],
    );
  });

  it('main faz scroll interno e header não usa sticky sobre o conteúdo', async () => {
    useAuth.mockReturnValue({ tipoPerfil: 'Passageiro' });

    await act(async () => {
      renderWithRouterAndTheme(<Layout />);
    });

    const header = document.querySelector('header');
    const main = document.querySelector('main');
    expect(header).not.toHaveClass('sticky');
    expect(main).toHaveClass('min-h-0');
    expect(main).toHaveClass('overflow-y-auto');
  });
});
