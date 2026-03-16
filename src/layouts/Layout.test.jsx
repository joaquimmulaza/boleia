import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Layout from './Layout';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signOut: vi.fn().mockResolvedValue({}),
    },
  },
}));

import { supabase } from '../lib/supabase';

const renderLayout = (initialPath = '/') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<div>Página Filha</div>} />
        </Route>
        <Route path="/auth" element={<div>Página de Auth</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('Layout Component', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza o conteúdo filho (Outlet) e o botão de Logout', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } } },
    });

    renderLayout();
    await waitFor(() => expect(screen.getByText('Página Filha')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /terminar sessão/i })).toBeInTheDocument();
  });

  it('mostra navegação de Passageiro (Início, Acordos, Faltas, Perfil) quando tipo_perfil é Passageiro', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } } },
    });

    renderLayout();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /início/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /acordos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /faltas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument();
  });

  it('mostra navegação de Motorista (Início, Acordos, Faltas, Perfil) quando tipo_perfil é Motorista', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Motorista' } } } },
    });

    renderLayout();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /início/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /acordos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /faltas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument();
  });

  it('mostra a navegação de Passageiro por defeito quando não há sessão', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    renderLayout();

    // Sem sessão, tipoPerfil é null, logo a navegação de Passageiro é o padrão
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /início/i })).toBeInTheDocument();
    });
  });

  it('os itens de navegação são links <a> e não botões', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } } },
    });

    renderLayout();

    await waitFor(() => {
      const navLinks = screen.getAllByRole('link');
      // A BottomBar deve ter 4 links de navegação
      expect(navLinks.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('link "Acordos" aponta para /acordos', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } } },
    });

    renderLayout();

    await waitFor(() => {
      const acordosLink = screen.getByRole('link', { name: /acordos/i });
      expect(acordosLink).toHaveAttribute('href', '/acordos');
    });
  });
});
