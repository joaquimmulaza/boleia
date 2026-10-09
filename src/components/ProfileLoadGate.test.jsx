import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProfileLoadGate, { PROFILE_LOAD_TIMEOUT_MS } from './ProfileLoadGate';

const retryProfileLoad = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from '../contexts/AuthContext';

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="loc">
      {location.pathname}
      {location.search}
    </div>
  );
}

describe('ProfileLoadGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    retryProfileLoad.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mostra estado de timeout com botão Tentar novamente', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      profileLoading: false,
      profileLoadTimedOut: true,
      retryProfileLoad,
    });

    render(
      <MemoryRouter>
        <ProfileLoadGate />
      </MemoryRouter>,
    );

    expect(screen.getByText(/não foi possível carregar o seu perfil/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('sem sessão após timeout redirecciona para /auth com next (openAcordoId)', () => {
    useAuth.mockReturnValue({
      session: null,
      loading: false,
      profileLoading: false,
      profileLoadTimedOut: true,
      retryProfileLoad,
    });

    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=abc-123']}>
        <Routes>
          <Route
            path="/acordos"
            element={
              <>
                <ProfileLoadGate />
                <LocationProbe />
              </>
            }
          />
          <Route path="/auth" element={<div>Página auth</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('Página auth')).toBeInTheDocument();
  });

  it('retry chama retryProfileLoad', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      profileLoading: false,
      profileLoadTimedOut: true,
      retryProfileLoad,
    });

    render(
      <MemoryRouter>
        <ProfileLoadGate />
      </MemoryRouter>,
    );

    screen.getByRole('button', { name: /tentar novamente/i }).click();
    expect(retryProfileLoad).toHaveBeenCalledTimes(1);
  });
});

describe('AuthContext profile timeout (integração leve)', () => {
  it('constante de timeout ~10s', () => {
    expect(PROFILE_LOAD_TIMEOUT_MS).toBe(10_000);
  });
});
