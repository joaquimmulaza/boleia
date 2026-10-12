import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DevAppRoutes from './DevAppRoutes.jsx';
import * as devCaptureAccess from '../utils/devCaptureAccess';

const PREVIEW_HOST = 'boleia-4khaffcwr-joaquim-mulazas-projects.vercel.app';

describe('DevAppRoutes — allowlist (simula build prod)', () => {
  /** @type {import('vitest').MockInstance} */
  let routesEnabledSpy;

  beforeEach(() => {
    routesEnabledSpy = vi.spyOn(devCaptureAccess, 'isDevCaptureRoutesEnabled').mockImplementation(
      (hostname) => devCaptureAccess.isDevCaptureAllowedHost(hostname),
    );
  });

  afterEach(() => {
    routesEnabledSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it.each([
    ['boleia-cyan.vercel.app'],
    ['boleia-joaquim-mulazas-projects.vercel.app'],
    ['boleia-git-main-joaquim-mulazas-projects.vercel.app'],
  ])('prod/git %s: redirecciona (sem captura notif-cards-269)', (host) => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue(host);
    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('dev-notif-cards-269-capture')).not.toBeInTheDocument();
  });

  it('preview hash: notif-cards-269, acordos-chips e pagamento-panel', () => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue(PREVIEW_HOST);

    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dev-notif-cards-269-capture')).toBeInTheDocument();

    render(
      <MemoryRouter initialEntries={['/acordos-chips']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dev-acordos-chip-capture')).toBeInTheDocument();
    expect(screen.getByTestId('dev-pagamento-comprovativo-capture')).toBeInTheDocument();
  });

  it('localhost: acordos-chips e pagamento-panel', () => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('127.0.0.1');
    render(
      <MemoryRouter initialEntries={['/acordos-chips']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dev-acordos-chip-capture')).toBeInTheDocument();
    expect(screen.getByTestId('dev-pagamento-comprovativo-capture')).toBeInTheDocument();
  });

  it('domínio desconhecido: redirecciona', () => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('custom-domain.example');
    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('dev-notif-cards-269-capture')).not.toBeInTheDocument();
  });
});
