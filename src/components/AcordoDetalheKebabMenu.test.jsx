import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import AcordoDetalheKebabMenu from './AcordoDetalheKebabMenu';
import { resetOverlayStackForTests } from '../utils/overlayStack';

describe('AcordoDetalheKebabMenu', () => {
  afterEach(() => {
    cleanup();
    resetOverlayStackForTests();
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

  it('fecha o menu com Escape e devolve foco ao botão', () => {
    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas
        podeEncerrar
        onRegistarFalta={vi.fn()}
        onEncerrar={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Mais acções do acordo/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it('Enter e Espaço em Encerrar acordo activam o callback uma única vez cada', async () => {
    const user = userEvent.setup();
    const onEncerrar = vi.fn();

    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas={false}
        podeEncerrar
        onRegistarFalta={vi.fn()}
        onEncerrar={onEncerrar}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Mais acções do acordo/i }));
    const item = screen.getByRole('menuitem', { name: /Encerrar acordo/i });
    item.focus();
    await user.keyboard('{Enter}');
    expect(onEncerrar).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mais acções do acordo/i }));
    const item2 = screen.getByRole('menuitem', { name: /Encerrar acordo/i });
    item2.focus();
    await user.keyboard(' ');
    expect(onEncerrar).toHaveBeenCalledTimes(2);
  });

  it('fecha com segundo toque no botão', () => {
    render(
      <AcordoDetalheKebabMenu
        podeRegistarFaltas
        podeEncerrar
        onRegistarFalta={vi.fn()}
        onEncerrar={vi.fn()}
      />,
    );

    const trigger = screen.getByRole('button', { name: /Mais acções do acordo/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
