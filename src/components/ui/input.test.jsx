import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from './input';

describe('Input (shadcn)', () => {
  it('aplica borda e fundo visíveis em modo claro', () => {
    render(<Input aria-label="Campo teste" />);
    const input = screen.getByRole('textbox', { name: 'Campo teste' });
    expect(input.className).toMatch(/border-input/);
    expect(input.className).toMatch(/bg-background/);
    expect(input.className).toMatch(/border/);
  });

  it('expõe displayName para devtools e testes', () => {
    expect(Input.displayName).toBe('Input');
  });
});
