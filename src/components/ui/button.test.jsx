import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button (shadcn)', () => {
  it('renderiza o texto do botão', () => {
    render(<Button>Confirmar boleia</Button>);
    expect(screen.getByRole('button', { name: 'Confirmar boleia' })).toBeInTheDocument();
  });

  it('aplica a variante outline', () => {
    render(<Button variant="outline">Cancelar</Button>);
    const btn = screen.getByRole('button', { name: 'Cancelar' });
    expect(btn.className).toMatch(/border/);
  });

  it('variante default usa texto escuro sobre verde (AA)', () => {
    render(<Button>Ver boleias</Button>);
    const btn = screen.getByRole('button', { name: 'Ver boleias' });
    expect(btn.className).toMatch(/text-primary-foreground/);
    expect(btn.className).not.toMatch(/text-white/);
  });
});
