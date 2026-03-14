import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './MainLayout';

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

const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<div>Página Filha</div>} />
        </Route>
        <Route path="/auth" element={<div>Página de Auth</div>} />
      </Routes>
    </MemoryRouter>
  );

describe('MainLayout Component', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renderiza o conteúdo filho (Outlet) e o botão de Logout', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } } },
    });

    renderLayout();
    await waitFor(() => expect(screen.getByText('Página Filha')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /terminar sessão/i })).toBeInTheDocument();
  });

  it('mostra navegação de Passageiro (Mapa, Meus Acordos, Perfil) quando tipo_perfil é Passageiro', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Passageiro' } } } },
    });

    renderLayout();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /mapa/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /meus acordos/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument();
  });

  it('mostra navegação de Motorista (Meu Veículo, Passageiros, Perfil) quando tipo_perfil é Motorista', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { user: { user_metadata: { tipo_perfil: 'Motorista' } } } },
    });

    renderLayout();

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /meu veículo/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /passageiros/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /perfil/i })).toBeInTheDocument();
  });

  it('mostra a navegação de Passageiro por defeito quando não há sessão', async () => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    renderLayout();

    // Without session, tipoPerfil is null, so Passenger nav is the default
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /mapa/i })).toBeInTheDocument();
    });
  });
});
