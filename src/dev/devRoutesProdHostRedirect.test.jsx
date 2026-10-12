import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DevAppRoutes from './DevAppRoutes.jsx';
import * as devCaptureAccess from '../utils/devCaptureAccess';

describe('DevAppRoutes — guard hostname (build prod)', () => {
  /** @type {import('vitest').MockInstance} */
  let routesEnabledSpy;

  beforeEach(() => {
    routesEnabledSpy = vi.spyOn(devCaptureAccess, 'isDevCaptureRoutesEnabled').mockImplementation(
      (hostname) => devCaptureAccess.isDevCapturePreviewHost(hostname),
    );
  });

  afterEach(() => {
    routesEnabledSpy.mockRestore();
  });

  it.each([
    ['boleia-cyan.vercel.app'],
    ['boleia-joaquim-mulazas-projects.vercel.app'],
  ])('prod %s: não monta captura', (prodHost) => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue(prodHost);
    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('dev-notif-cards-269-capture')).not.toBeInTheDocument();
  });

  it('preview hash: monta captura notif-cards-269', () => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue(
      'boleia-4khaffcwr-joaquim-mulazas-projects.vercel.app',
    );
    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('dev-notif-cards-269-capture')).toBeInTheDocument();
  });

  it('domínio desconhecido: não monta captura', () => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('custom-domain.example');
    render(
      <MemoryRouter initialEntries={['/notif-cards-269']}>
        <DevAppRoutes />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('dev-notif-cards-269-capture')).not.toBeInTheDocument();
  });
});
