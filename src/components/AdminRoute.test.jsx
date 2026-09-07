import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AdminRoute from './AdminRoute';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
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

  it('permite acesso quando profile.is_admin é true', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'admin-1' } },
      loading: false,
      profileLoading: false,
      profile: { id: 'admin-1', is_admin: true },
    });
    renderAdminRoute();
    expect(screen.getByText('Admin OK')).toBeInTheDocument();
  });

  it('redirecciona para /acordos quando is_admin é falso', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'user-1' } },
      loading: false,
      profileLoading: false,
      profile: { id: 'user-1', is_admin: false },
    });
    renderAdminRoute();
    expect(screen.getByText('Acordos')).toBeInTheDocument();
  });
});
