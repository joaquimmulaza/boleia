import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AcordoDetalheKebabMenu from './AcordoDetalheKebabMenu';

describe('AcordoDetalheKebabMenu', () => {
  afterEach(() => {
    cleanup();
  });

  it('não renderiza kebab quando não há acções disponíveis', () => {
    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas={false}
        podeEncerrar={false}
        onRegistarFalta={vi.fn()}
        onEncerrar={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Mais acções do acordo/i })).not.toBeInTheDocument();
  });

  it('abre menu com Registar falta e Encerrar acordo', () => {
    const onRegistar = vi.fn();
    const onEncerrar = vi.fn();

    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas
        podeEncerrar
        onRegistarFalta={onRegistar}
        onEncerrar={onEncerrar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mais acções do acordo/i }));

    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Registar falta/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /Encerrar acordo/i })).toBeInTheDocument();
  });

  it('dispara callbacks e fecha o menu', () => {
    const onRegistar = vi.fn();
    const onEncerrar = vi.fn();

    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas
        podeEncerrar
        onRegistarFalta={onRegistar}
        onEncerrar={onEncerrar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mais acções do acordo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Registar falta/i }));
    expect(onRegistar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Mais acções do acordo/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar acordo/i }));
    expect(onEncerrar).toHaveBeenCalledTimes(1);
  });

  it('fecha o menu com Escape', () => {
    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas
        podeEncerrar
        onRegistarFalta={vi.fn()}
        onEncerrar={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Mais acções do acordo/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
