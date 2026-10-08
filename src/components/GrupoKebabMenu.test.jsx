import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GrupoKebabMenu from './GrupoKebabMenu';

describe('GrupoKebabMenu', () => {
  it('não renderiza o kebab quando não há acções', () => {
    render(
      <GrupoKebabMenu
        canEditar={false}
        canApagar={false}
        canSair={false}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
        onSair={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /Mais acções do grupo/i })).not.toBeInTheDocument();
  });

  it('fecha com segundo toque no trigger', () => {
    render(
      <GrupoKebabMenu
        canEditar
        canApagar={false}
        canSair={false}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
        onSair={vi.fn()}
      />,
    );
    const trigger = screen.getByRole('button', { name: /Mais acções do grupo/i });
    fireEvent.click(trigger);
    expect(screen.getByTestId('grupo-kebab-menu')).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByTestId('grupo-kebab-menu')).not.toBeInTheDocument();
  });

  it('omite Apagar em vez de o mostrar desactivado', () => {
    render(
      <GrupoKebabMenu
        canEditar
        canApagar={false}
        canSair={false}
        onEditar={vi.fn()}
        onApagar={vi.fn()}
        onSair={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Mais acções do grupo/i }));
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Apagar grupo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /Sair do grupo/i })).not.toBeInTheDocument();
  });
});
