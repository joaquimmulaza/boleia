import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '../lib/supabase';

// Helper to render within a router context
const renderWithRouter = (ui, { initialEntries = ['/'] } = {}) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/auth" element={<div>Página de Auth</div>} />
        <Route path="/passageiro" element={<div>Dashboard Passageiro</div>} />
        <Route path="/motorista" element={<div>Dashboard Motorista</div>} />
        <Route
          path="/protegido"
          element={<ProtectedRoute allowedRole="Passageiro" />}
        >
          <Route index element={<div>Conteúdo Protegido</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain for supabase.from
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: { tipo_perfil: 'Passageiro' }, error: null });

    supabase.from.mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      single: mockSingle,
    });
  });

  it('deve redirecionar para /auth quando não há utilizador autenticado', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

    renderWithRouter(<></>, { initialEntries: ['/protegido'] });

    await waitFor(() => {
      expect(screen.getByText('Página de Auth')).toBeInTheDocument();
    });
  });

  it('deve redirecionar para /auth quando houver erro na autenticação', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Auth error') });

    renderWithRouter(<></>, { initialEntries: ['/protegido'] });

    await waitFor(() => {
      expect(screen.getByText('Página de Auth')).toBeInTheDocument();
    });
  });

  it('deve redirecionar para /motorista quando um Motorista tenta aceder a uma rota de Passageiro', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: 'user-123' },
      },
      error: null,
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { tipo_perfil: 'Motorista' }, error: null }),
    });
    // Route with allowedRole="Passageiro", but user is "Motorista"
    render(
      <MemoryRouter initialEntries={['/protegido']}>
        <Routes>
          <Route path="/auth" element={<div>Página de Auth</div>} />
          <Route path="/passageiro" element={<div>Dashboard Passageiro</div>} />
          <Route path="/motorista" element={<div>Dashboard Motorista</div>} />
          <Route
            path="/protegido"
            element={<ProtectedRoute allowedRole="Passageiro" />}
          >
            <Route index element={<div>Conteúdo Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Motorista')).toBeInTheDocument();
    });
  });

  it('deve redirecionar para /passageiro quando um Passageiro tenta aceder a uma rota de Motorista', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: 'user-123' },
      },
      error: null,
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { tipo_perfil: 'Passageiro' }, error: null }),
    });
    render(
      <MemoryRouter initialEntries={['/protegido-motorista']}>
        <Routes>
          <Route path="/auth" element={<div>Página de Auth</div>} />
          <Route path="/passageiro" element={<div>Dashboard Passageiro</div>} />
          <Route path="/motorista" element={<div>Dashboard Motorista</div>} />
          <Route
            path="/protegido-motorista"
            element={<ProtectedRoute allowedRole="Motorista" />}
          >
            <Route index element={<div>Conteúdo Motorista Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Dashboard Passageiro')).toBeInTheDocument();
    });
  });

  it('deve renderizar o conteúdo quando o utilizador tem o role correto', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: 'user-123' },
      },
      error: null,
    });

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { tipo_perfil: 'Passageiro' }, error: null }),
    });

    renderWithRouter(<></>, { initialEntries: ['/protegido'] });

    await waitFor(() => {
      expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
    });
  });

  it('deve renderizar o conteúdo quando não há allowedRole definida (rota genérica protegida)', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: { id: 'user-123' },
      },
      error: null,
    });

    render(
      <MemoryRouter initialEntries={['/qualquer-rota']}>
        <Routes>
          <Route path="/auth" element={<div>Página de Auth</div>} />
          <Route path="/qualquer-rota" element={<ProtectedRoute />}>
            <Route index element={<div>Conteúdo Genérico</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Conteúdo Genérico')).toBeInTheDocument();
    });
  });
});
