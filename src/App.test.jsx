import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppShell } from './App';

vi.mock('./pages/LandingPage', () => ({
  default: () => <div data-testid="landing-page">Landing</div>,
}));

vi.mock('./pages/Auth', () => ({
  default: () => <div data-testid="auth-page">Auth</div>,
}));

vi.mock('./pages/MarketplaceExplore', () => ({
  default: () => <div data-testid="marketplace-explore">Explorar</div>,
}));

vi.mock('./pages/PublicLegalPage', () => ({
  default: () => <div data-testid="public-legal-page">Legal</div>,
}));

vi.mock('./layouts/Layout', () => ({
  default: () => <div data-testid="app-layout">Layout</div>,
}));

vi.mock('./components/ProtectedRoute', () => ({
  default: ({ children }) => children,
}));

vi.mock('./components/UpdatePrompt', () => ({
  default: () => null,
}));

vi.mock('./components/OfflineBanner', () => ({
  default: () => <div data-testid="offline-banner">Offline</div>,
}));

vi.mock('./hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false }),
}));

vi.mock('./hooks/usePasswordRecoveryRouteRedirect', () => ({
  usePasswordRecoveryRouteRedirect: () => {},
}));

vi.mock('./dev/DevAppRoutes.jsx', async () => {
  const { Routes, Route } = await import('react-router-dom');
  return {
    default: function MockDevAppRoutes() {
      return (
        <Routes>
          <Route path="perfil-push" element={<div data-testid="dev-perfil-push-route">Push DEV</div>} />
          <Route path="perfil" element={<div data-testid="dev-perfil-route">Perfil DEV</div>} />
        </Routes>
      );
    },
  };
});

vi.mock('./contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from './contexts/AuthContext';

describe('AppShell — scroll por tipo de rota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      session: null,
      loading: false,
      tipoPerfil: null,
    });
  });

  it('rotas públicas /, /auth e /explorar não usam shell h-dvh overflow-hidden', () => {
    const { container, unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    expect(container.querySelector('.overflow-hidden.h-dvh')).toBeNull();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    unmount();

    const authRender = render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(authRender.container.querySelector('.overflow-hidden.h-dvh')).toBeNull();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    authRender.unmount();

    const exploreRender = render(
      <MemoryRouter initialEntries={['/explorar']}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('marketplace-explore')).toBeInTheDocument();
    expect(exploreRender.container.querySelector('.overflow-hidden.h-dvh')).toBeNull();
    expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    exploreRender.unmount();

    for (const path of ['/privacidade', '/eliminacao-de-dados']) {
      const legalRender = render(
        <MemoryRouter initialEntries={[path]}>
          <AppShell />
        </MemoryRouter>,
      );

      expect(screen.getByTestId('public-legal-page')).toBeInTheDocument();
      expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
      expect(legalRender.container.querySelector('.overflow-hidden.h-dvh')).toBeNull();
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
      legalRender.unmount();
    }
  });

  it('rotas autenticadas mantêm shell h-dvh overflow-hidden com OfflineBanner', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      tipoPerfil: 'Passageiro',
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('app-layout')).toBeInTheDocument();
    expect(container.querySelector('.overflow-hidden.h-dvh')).not.toBeNull();
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
  });

  it('sessão com perfil incompleto em / vai para Auth', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      profileLoading: false,
      profile: { perfil_completo: false },
      tipoPerfil: null,
      passwordRecoveryPending: false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });

  (import.meta.env.DEV ? it : it.skip)('rotas DEV: / e /__dev/perfil montam sem substituir o router principal', async () => {
    const landing = render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    landing.unmount();

    render(
      <MemoryRouter initialEntries={['/__dev/perfil']}>
        <AppShell />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('dev-perfil-route')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('app-layout')).not.toBeInTheDocument();
  });

  it('sessão com passwordRecoveryPending em / redireciona para Auth', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      tipoPerfil: 'Passageiro',
      passwordRecoveryPending: true,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppShell />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('auth-page')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument();
  });
});
