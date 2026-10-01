import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TextFade from './TextFade';

describe('TextFade', () => {
  it('renderiza texto com classe text-fade (sem truncate/ellipsis)', () => {
    render(<TextFade>Rua comprida sem fim em Luanda</TextFade>);
    const el = screen.getByText('Rua comprida sem fim em Luanda');
    expect(el.className).toMatch(/text-fade/);
    expect(el.className).not.toMatch(/truncate/);
    expect(el.className).not.toMatch(/ellipsis/);
  });

  it('aceita elemento semântico via prop as', () => {
    render(<TextFade as="p">Talatona</TextFade>);
    const el = screen.getByText('Talatona');
    expect(el.tagName).toBe('P');
  });
});
