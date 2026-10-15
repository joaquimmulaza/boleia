import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DevAppRoutes from './DevAppRoutes.jsx';

vi.mock('../pages/AbsenceTracker', () => ({
  default: () => <div data-testid="faltas-capture-absence-tracker">AbsenceTracker</div>,
}));

/**
 * Espelha App.jsx: um único Router → `/__dev/*` → DevAppRoutes (sem BrowserRouter extra).
 * @param {string} path
 */
function renderDevFaltasPath(path) {
  const routerErrors = [];
  const consoleError = vi.spyOn(console, 'error').mockImplementation((...args) => {
    const msg = args.map(String).join(' ');
    if (/Router/i.test(msg) && /inside another/i.test(msg)) {
      routerErrors.push(msg);
    }
  });

  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/__dev/*" element={<DevAppRoutes />} />
      </Routes>
    </MemoryRouter>,
  );

  return { ...view, routerErrors, consoleError };
}

describe('faltas-capture DEV — routing (sem Router aninhado)', () => {
  beforeEach(() => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('127.0.0.1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('monta AbsenceTracker em /__dev/faltas-capture/:acordoId sem erro de Router aninhado', async () => {
    const { routerErrors } = renderDevFaltasPath(
      '/__dev/faltas-capture/3d9b352b-0000-0000-0000-000000000001',
    );
    expect(await screen.findByTestId('faltas-capture-absence-tracker')).toBeInTheDocument();
    expect(routerErrors).toEqual([]);
  });

  it('/__dev/faltas-capture sem :acordoId não rebenta nem regista Router aninhado', () => {
    const { routerErrors } = renderDevFaltasPath('/__dev/faltas-capture');
    expect(screen.queryByTestId('faltas-capture-absence-tracker')).not.toBeInTheDocument();
    expect(routerErrors).toEqual([]);
  });
});
