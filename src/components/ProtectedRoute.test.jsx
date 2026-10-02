import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock useAuth
import * as AuthContextModule from '../contexts/AuthContext';
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

const { useAuth } = AuthContextModule;

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
  });

  it('deve redirecionar para /auth quando não há sessão ativa', async () => {
    useAuth.mockReturnValue({ session: null, loading: false });

    renderWithRouter(<></>, { initialEntries: ['/protegido'] });

    await waitFor(() => {
      expect(screen.getByText('Página de Auth')).toBeInTheDocument();
    });
  });

  it('deve redirecionar para /motorista quando um Motorista tenta aceder a uma rota de Passageiro', async () => {
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      tipoPerfil: 'Motorista'
    });

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
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      tipoPerfil: 'Passageiro'
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
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      tipoPerfil: 'Passageiro'
    });

    renderWithRouter(<></>, { initialEntries: ['/protegido'] });

    await waitFor(() => {
      expect(screen.getByText('Conteúdo Protegido')).toBeInTheDocument();
    });
  });

  it('deve renderizar o conteúdo quando não há allowedRole definida (rota genérica protegida)', async () => {
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      tipoPerfil: 'Passageiro'
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

  it('deve redirecionar para /auth?mode=update-password quando passwordRecoveryPending', async () => {
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      tipoPerfil: 'Passageiro',
      passwordRecoveryPending: true,
    });

    render(
      <MemoryRouter initialEntries={['/protegido']}>
        <Routes>
          <Route path="/auth" element={<div>Página de Auth Recovery</div>} />
          <Route path="/protegido" element={<ProtectedRoute allowedRole="Passageiro" />}>
            <Route index element={<div>Conteúdo Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Página de Auth Recovery')).toBeInTheDocument();
    });
    expect(screen.queryByText('Conteúdo Protegido')).not.toBeInTheDocument();
  });

  it('espera o perfil antes de decidir a rota', () => {
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      profileLoading: true,
      tipoPerfil: null,
      profile: null,
    });

    renderWithRouter(<></>, { initialEntries: ['/protegido'] });
    expect(screen.getByText(/a carregar perfil/i)).toBeInTheDocument();
  });

  it('manda perfil incompleto para completar perfil', async () => {
    useAuth.mockReturnValue({
      session: { user: { id: '123' } },
      loading: false,
      profileLoading: false,
      tipoPerfil: null,
      profile: { perfil_completo: false },
    });

    function AuthProbe() {
      const location = useLocation();
      return <div>Destino {location.pathname}{location.search}</div>;
    }

    render(
      <MemoryRouter initialEntries={['/protegido']}>
        <Routes>
          <Route path="/auth" element={<AuthProbe />} />
          <Route path="/protegido" element={<ProtectedRoute allowedRole="Passageiro" />}>
            <Route index element={<div>Conteúdo Protegido</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Destino /auth?mode=completar-perfil')).toBeInTheDocument();
    });
  });
});
