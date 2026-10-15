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
        canSair
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

  it('com uma só acção, mostra botão directo (shadcn) em vez do kebab', () => {
    const onSair = vi.fn();
    render(
      <GrupoKebabMenu
        canEditar={false}
        canApagar={false}
        canSair
        onEditar={vi.fn()}
        onApagar={vi.fn()}
        onSair={onSair}
      />,
    );
    expect(screen.queryByRole('button', { name: /Mais acções do grupo/i })).not.toBeInTheDocument();
    const direct = screen.getByRole('button', { name: 'Sair do grupo' });
    expect(direct).toHaveAttribute('data-testid', 'grupo-acao-directa-sair');
    expect(direct.className).toMatch(/inline-flex/);
    fireEvent.click(direct);
    expect(onSair).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Apagar grupo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sair do grupo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mais acções do grupo/i })).not.toBeInTheDocument();
  });
});
