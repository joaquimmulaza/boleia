import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import RouteOdRow from './RouteOdRow';

describe('RouteOdRow', () => {
  /** @type {ResizeObserverCallback[]} */
  let observerCallbacks = [];

  beforeEach(() => {
    observerCallbacks = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        /**
         * @param {ResizeObserverCallback} cb
         */
        constructor(cb) {
          observerCallbacks.push(cb);
        }
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('mostra origem e destino com title nativo do texto completo', () => {
    render(
      <RouteOdRow
        origem="Kero Talatona, Avenida Samora Machel"
        destino="Angola Independent University (UnIA)"
      />,
    );
    expect(
      screen.getByTitle('Kero Talatona, Avenida Samora Machel'),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('Angola Independent University (UnIA)'),
    ).toBeInTheDocument();
  });

  it('usa flex compacto de 1 linha (sem grid 1fr nem line-clamp / fade-y-2)', () => {
    const { container } = render(
      <RouteOdRow origem="Viana, Angola" destino="Tala-Hady, Angola" />,
    );
    const row = container.firstChild;
    expect(row.className).toMatch(/flex/);
    expect(row.className).toMatch(/flex-row|items-center/);
    expect(row.className).toMatch(/w-fit/);
    expect(row.className).not.toMatch(/grid-cols-/);
    expect(row.className).not.toMatch(/grid\b/);

    const origem = screen.getByTitle('Viana, Angola');
    const destino = screen.getByTitle('Tala-Hady, Angola');
    expect(origem.className).toMatch(/whitespace-nowrap/);
    expect(destino.className).toMatch(/whitespace-nowrap/);
    expect(origem.className).not.toMatch(/truncate-fade-y/);
    expect(destino.className).not.toMatch(/truncate-fade-y/);
    expect(origem.className).not.toMatch(/line-clamp/);
    expect(destino.className).not.toMatch(/line-clamp/);
    expect(origem.className).toMatch(/text-end/);
    expect(destino.className).toMatch(/text-start/);
    expect(origem.className).toMatch(/max-w-/);
    expect(destino.className).toMatch(/max-w-/);
  });

  it('renderiza seta shrink-0 self-center entre origem e destino', () => {
    const { container } = render(
      <RouteOdRow origem="Talatona" destino="Miramar" />,
    );
    const row = container.firstChild;
    expect(row.children).toHaveLength(3);
    const arrowWrap = row.children[1];
    expect(arrowWrap.className).toMatch(/shrink-0/);
    expect(arrowWrap.className).toMatch(/self-center/);
  });

  it('não aplica is-truncated quando o texto cabe no container', () => {
    render(<RouteOdRow origem="A" destino="B" />);
    const a = screen.getByTitle('A');
    const b = screen.getByTitle('B');

    Object.defineProperty(a, 'scrollWidth', { configurable: true, get: () => 40 });
    Object.defineProperty(a, 'clientWidth', { configurable: true, get: () => 40 });
    Object.defineProperty(b, 'scrollWidth', { configurable: true, get: () => 40 });
    Object.defineProperty(b, 'clientWidth', { configurable: true, get: () => 40 });

    act(() => {
      observerCallbacks.forEach((cb) => cb([], /** @type {ResizeObserver} */ ({})));
    });

    expect(a.className).not.toMatch(/is-truncated/);
    expect(b.className).not.toMatch(/is-truncated/);
  });

  it('aplica is-truncated só quando o texto excede o container', () => {
    render(
      <RouteOdRow
        origem="Talatona"
        destino="New Kilamba Town, Avenida Principal Extended Name"
      />,
    );
    const origem = screen.getByTitle('Talatona');
    const destino = screen.getByTitle(
      'New Kilamba Town, Avenida Principal Extended Name',
    );

    Object.defineProperty(origem, 'scrollWidth', {
      configurable: true,
      get: () => 50,
    });
    Object.defineProperty(origem, 'clientWidth', {
      configurable: true,
      get: () => 50,
    });
    Object.defineProperty(destino, 'scrollWidth', {
      configurable: true,
      get: () => 300,
    });
    Object.defineProperty(destino, 'clientWidth', {
      configurable: true,
      get: () => 100,
    });

    act(() => {
      observerCallbacks.forEach((cb) => cb([], /** @type {ResizeObserver} */ ({})));
    });

    expect(origem.className).not.toMatch(/is-truncated/);
    expect(destino.className).toMatch(/is-truncated/);
    expect(destino.className).toMatch(/truncate-fade-x/);
  });
});
