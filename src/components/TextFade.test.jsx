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

  it('com 2 linhas não aplica fade nem ellipsis quando o texto cabe', () => {
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(48);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(48);

    render(
      <TextFade lines={2}>Terminal Rodoviário de Viana, junto ao mercado</TextFade>,
    );
    const el = screen.getByText('Terminal Rodoviário de Viana, junto ao mercado');
    expect(el.className).not.toMatch(/text-fade-lines/);
    expect(el.className).not.toMatch(/truncate/);
    expect(el.className).not.toMatch(/ellipsis/);
    expect(el).toHaveAccessibleName('Terminal Rodoviário de Viana, junto ao mercado');

    heightSpy.mockRestore();
    clientHeightSpy.mockRestore();
  });

  it('com 2 linhas aplica fade só quando a 3.ª linha seria cortada', () => {
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(72);
    const clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(48);

    const texto = 'Terminal Rodoviário de Viana, junto ao mercado municipal de Luanda';
    render(<TextFade lines={2}>{texto}</TextFade>);
    const el = screen.getByText(texto);
    expect(el.className).toMatch(/text-fade-lines/);
    expect(el.className).not.toMatch(/text-fade(?!-)/);
    expect(el.className).not.toMatch(/truncate/);
    expect(el.className).not.toMatch(/ellipsis/);
    expect(el.textContent).toBe(texto);
    expect(el.textContent).not.toMatch(/…|\.\.\./);
    expect(el).toHaveAccessibleName(texto);

    heightSpy.mockRestore();
    clientHeightSpy.mockRestore();
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
