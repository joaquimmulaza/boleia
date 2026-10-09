import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProfileLoadGate, { PROFILE_LOAD_TIMEOUT_MS } from './ProfileLoadGate';

const VALID_ACORDO_ID = '3f42eca2-03c9-8153-b9ea-c6e621e03656';

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

  it('mostra copy aprovada de timeout com botão Tentar outra vez', () => {
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

    expect(screen.getByText('Não foi possível carregar a tua conta. Tenta outra vez.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar outra vez/i })).toBeInTheDocument();
    expect(screen.queryByText(/não foi possível carregar o seu perfil/i)).not.toBeInTheDocument();
  });

  it('sessão expirada após timeout redirecciona para /auth?openAcordoId&sessionEnded=1', () => {
    useAuth.mockReturnValue({
      session: null,
      loading: false,
      profileLoading: false,
      profileLoadTimedOut: true,
      retryProfileLoad,
    });

    render(
      <MemoryRouter initialEntries={[`/acordos?openAcordoId=${VALID_ACORDO_ID}`]}>
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
          <Route path="/auth" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('loc')).toHaveTextContent(
      `/auth?openAcordoId=${VALID_ACORDO_ID}&sessionEnded=1`,
    );
    expect(screen.queryByText(/não foi possível carregar a tua conta/i)).not.toBeInTheDocument();
  });

  it('openAcordoId inválido na URL de auth omite o parâmetro', () => {
    useAuth.mockReturnValue({
      session: null,
      loading: false,
      profileLoading: false,
      profileLoadTimedOut: true,
      retryProfileLoad,
    });

    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=../../evil']}>
        <Routes>
          <Route path="/acordos" element={<ProfileLoadGate />} />
          <Route path="/auth" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('loc')).toHaveTextContent('/auth?sessionEnded=1');
  });

  it('«Tentar outra vez» não redirecciona — mantém pathname e query', () => {
    useAuth.mockReturnValue({
      session: { user: { id: 'u1' } },
      loading: false,
      profileLoading: false,
      profileLoadTimedOut: true,
      retryProfileLoad,
    });

    render(
      <MemoryRouter initialEntries={[`/acordos?openAcordoId=${VALID_ACORDO_ID}`]}>
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
          <Route path="/passageiro" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    );

    screen.getByRole('button', { name: /tentar outra vez/i }).click();
    expect(retryProfileLoad).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loc')).toHaveTextContent(
      `/acordos?openAcordoId=${VALID_ACORDO_ID}`,
    );
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

    screen.getByRole('button', { name: /tentar outra vez/i }).click();
    expect(retryProfileLoad).toHaveBeenCalledTimes(1);
  });
});

describe('AuthContext profile timeout (integração leve)', () => {
  it('constante de timeout ~10s', () => {
    expect(PROFILE_LOAD_TIMEOUT_MS).toBe(10_000);
  });
});
