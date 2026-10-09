import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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
  default: () => null,
}));

vi.mock('./hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOffline: false }),
}));

vi.mock('./hooks/usePasswordRecoveryRouteRedirect', () => ({
  usePasswordRecoveryRouteRedirect: () => {},
}));

vi.mock('./contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }) => children,
}));

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: vi.fn(),
}));

vi.mock('./dev/LazyDevRoutes.jsx', async () => {
  const { Routes, Route } = await import('react-router-dom');
  return {
    default: function MockLazyDevRoutes() {
      return (
        <Routes>
          <Route path="perfil" element={<div data-testid="dev-perfil-route">Perfil DEV</div>} />
        </Routes>
      );
    },
  };
});

import { useAuth } from './contexts/AuthContext';
import App from './App';

describe('App — smoke (regressão Suspense / rotas)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      session: null,
      loading: false,
      tipoPerfil: null,
    });
  });

  it('App.jsx importa Suspense quando renderiza <Suspense> (regressão 55ca2c8)', () => {
    const appPath = resolve(process.cwd(), 'src/App.jsx');
    const src = readFileSync(appPath, 'utf8');
    expect(src.includes('<Suspense')).toBe(true);
    expect(src).toMatch(/import\s+React,\s*\{[^}]*\bSuspense\b/);
  });

  it('renderiza <App /> na raiz / sem ReferenceError (modo prod: sem rotas __dev)', async () => {
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('landing-page')).toBeInTheDocument();
    });
  });

  (import.meta.env.DEV ? it : it.skip)('renderiza <App /> em DEV com /__dev/perfil', async () => {
    window.history.replaceState(null, '', '/__dev/perfil');
    render(<App />);
    await waitFor(() => {
      expect(screen.getByTestId('dev-perfil-route')).toBeInTheDocument();
    });
  });
});
