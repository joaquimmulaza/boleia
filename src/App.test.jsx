import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppShell } from './App';

vi.mock('./pages/LandingPage', () => ({
  default: () => <div data-testid="landing-page">Landing</div>,
}));

vi.mock('./pages/Auth', () => ({
  default: () => <div data-testid="auth-page">Auth</div>,
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

  it('rotas públicas / e /auth não usam shell h-dvh overflow-hidden', () => {
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
});
