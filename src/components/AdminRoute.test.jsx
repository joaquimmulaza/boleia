import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AdminRoute from './AdminRoute';
import { supabase } from '../lib/supabase';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { useAuth } from '../contexts/AuthContext';

function renderAdminRoute() {
  return render(
    <MemoryRouter initialEntries={['/admin/pagamentos']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/pagamentos" element={<div>Admin OK</div>} />
        </Route>
        <Route path="/acordos" element={<div>Acordos</div>} />
        <Route path="/auth" element={<div>Auth</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdminRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra verificação enquanto loading', () => {
    useAuth.mockReturnValue({ session: null, loading: true, profileLoading: false, profile: null });
    renderAdminRoute();
    expect(screen.getByText(/a verificar sessão/i)).toBeInTheDocument();
  });

  it('não redirecciona para acordos enquanto perfil ainda carrega (sessão activa)', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'admin-1' } },
      loading: false,
      profileLoading: true,
      profile: null,
    });
    renderAdminRoute();
    expect(screen.getByText(/a carregar perfil/i)).toBeInTheDocument();
    expect(screen.queryByText('Acordos')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin OK')).not.toBeInTheDocument();
  });

  it('permite acesso quando is_platform_admin devolve true', async () => {
    supabase.rpc.mockResolvedValue({ data: true, error: null });
    useAuth.mockReturnValue({
      session: { user: { id: 'admin-1' } },
      loading: false,
      profileLoading: false,
      profile: { id: 'admin-1', perfil_completo: true },
    });
    renderAdminRoute();
    expect(await screen.findByText('Admin OK')).toBeInTheDocument();
    expect(supabase.rpc).toHaveBeenCalledWith('is_platform_admin');
  });

  it('redirecciona para /acordos quando a sessão não é admin', async () => {
    supabase.rpc.mockResolvedValue({ data: false, error: null });
    useAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      loading: false,
      profileLoading: false,
      profile: { id: 'user-1', perfil_completo: true },
    });
    renderAdminRoute();
    expect(await screen.findByText('Acordos')).toBeInTheDocument();
    expect(screen.queryByText('Admin OK')).not.toBeInTheDocument();
  });

  it('redirecciona perfil incompleto para completar perfil', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      profileLoading: false,
      profile: { id: 'u1', perfil_completo: false },
      passwordRecoveryPending: false,
    });
    renderAdminRoute();
    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.queryByText('Admin OK')).not.toBeInTheDocument();
  });

  it('redirecciona para update-password quando passwordRecoveryPending', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'admin-1' } },
      loading: false,
      profileLoading: false,
      profile: { id: 'admin-1', perfil_completo: true },
      passwordRecoveryPending: true,
    });
    renderAdminRoute();
    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.queryByText('Admin OK')).not.toBeInTheDocument();
  });
});
