import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';
import { supabase } from '../lib/supabase';
import { ThemeProvider } from '../contexts/ThemeContext';

// Mock do supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
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

    const logo = screen.getByAltText(/Boleia Certa/i);
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/boleia-logo.png');
  });
});
