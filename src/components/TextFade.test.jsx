import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TextFade from './TextFade';

describe('TextFade', () => {
  /** @type {ResizeObserver | undefined} */
  let OriginalResizeObserver;

  beforeEach(() => {
    OriginalResizeObserver = global.ResizeObserver;
    global.ResizeObserver = class {
      /** @param {ResizeObserverCallback} cb */
      constructor(cb) {
        this.cb = cb;
      }
      /** @param {Element} el */
      observe(el) {
        this.el = el;
      }
      disconnect() {}
    };
  });

  afterEach(() => {
    global.ResizeObserver = OriginalResizeObserver;
  });

  it('não aplica text-fade quando o texto cabe', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(40);
    const clientSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);

    render(<TextFade>Curto</TextFade>);
    const el = screen.getByText('Curto');
    expect(el.className).not.toMatch(/text-fade/);
    expect(el.className).not.toMatch(/truncate/);

    spy.mockRestore();
    clientSpy.mockRestore();
  });

  it('aplica text-fade só com overflow (sem ellipsis)', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(200);
    const clientSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);

    render(<TextFade>Rua comprida sem fim em Luanda</TextFade>);
    const el = screen.getByText('Rua comprida sem fim em Luanda');
    expect(el.className).toMatch(/text-fade/);
    expect(el.className).not.toMatch(/truncate/);
    expect(el.className).not.toMatch(/ellipsis/);

    spy.mockRestore();
    clientSpy.mockRestore();
  });

  it('aceita elemento semântico via prop as', () => {
    const spy = vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(40);
    const clientSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(100);

    render(<TextFade as="p">Talatona</TextFade>);
    const el = screen.getByText('Talatona');
    expect(el.tagName).toBe('P');

    spy.mockRestore();
    clientSpy.mockRestore();
  });
});
