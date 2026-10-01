import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OfertaKebabMenu from './OfertaKebabMenu';

describe('OfertaKebabMenu', () => {
  it('mostra só Editar e Despublicar quando permitido', () => {
    render(
      <OfertaKebabMenu
        canEdit
        canDespublicar
        onEditar={vi.fn()}
        onDespublicar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mais acções/i }));
    expect(screen.getByRole('menuitem', { name: /Editar oferta/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Despublicar oferta/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Eliminar/i })).not.toBeInTheDocument();
  });

  it('Despublicar é destructive (vermelho)', () => {
    render(
      <OfertaKebabMenu canEdit canDespublicar onEditar={vi.fn()} onDespublicar={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Mais acções/i }));
    const item = screen.getByRole('menuitem', { name: /Despublicar oferta/i });
    expect(item.className).toMatch(/text-red/);
  });

  it('não renderiza kebab se sem acções', () => {
    const { container } = render(
      <OfertaKebabMenu canEdit={false} canDespublicar={false} onEditar={vi.fn()} onDespublicar={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
