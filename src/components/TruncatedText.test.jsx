import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TruncatedText from './TruncatedText';

describe('TruncatedText', () => {
  it('renderiza o texto e expõe title completo', () => {
    const longo =
      'Kero Talatona, Avenida Samora Machel, Talatona, Luanda, Angola';
    render(<TruncatedText text={longo} />);
    const el = screen.getByText(longo);
    expect(el).toHaveAttribute('title', longo);
  });

  it('aplica fade de 2 linhas por omissão, sem line-clamp/reticências', () => {
    render(<TruncatedText text="Origem longa" />);
    const el = screen.getByText('Origem longa');
    expect(el.className).toMatch(/truncate-fade-y-2/);
    expect(el.className).not.toMatch(/line-clamp/);
    expect(el.className).not.toMatch(/(?:^|\s)truncate(?:\s|$)/);
  });

  it('aceita lines=1 e className extra', () => {
    render(
      <TruncatedText text="Pickup" lines={1} className="text-xs text-slate-500" />,
    );
    const el = screen.getByText('Pickup');
    expect(el.className).toMatch(/truncate-fade-y-1/);
    expect(el.className).toMatch(/text-xs/);
    expect(el.className).not.toMatch(/line-clamp/);
  });

  it('não define altura mínima forçada (só classe de max-height via CSS)', () => {
    render(<TruncatedText text="Talatona" />);
    const el = screen.getByText('Talatona');
    expect(el.style.minHeight).toBe('');
    expect(el.style.height).toBe('');
    expect(el.className).toMatch(/truncate-fade-y-2/);
  });
});
