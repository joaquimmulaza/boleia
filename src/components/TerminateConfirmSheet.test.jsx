import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import TerminateConfirmSheet from './TerminateConfirmSheet';

describe('TerminateConfirmSheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('não renderiza quando fechado', () => {
    render(
      <TerminateConfirmSheet
        isOpen={false}
        title="Encerrar acordo?"
        body="Corpo"
        confirmText="Encerrar acordo"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('terminate-confirm-sheet')).not.toBeInTheDocument();
  });

  it('renderiza handle, Fechar, Cancelar e acção destrutiva', () => {
    render(
      <TerminateConfirmSheet
        isOpen
        title="Encerrar acordo?"
        body="Vais encerrar o acordo com Ana (Talatona → Mutamba). Esta acção não se pode desfazer."
        confirmText="Encerrar acordo"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByTestId('terminate-confirm-sheet')).toBeInTheDocument();
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fechar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Cancelar$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Encerrar acordo$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Requer confirmação explícita/i)).not.toBeInTheDocument();
  });

  it('chama onConfirm e onCancel', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <TerminateConfirmSheet
        isOpen
        title="Encerrar acordo?"
        body="Corpo"
        confirmText="Encerrar acordo"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('fecha com Escape quando não está busy', () => {
    const onCancel = vi.fn();

    render(
      <TerminateConfirmSheet
        isOpen
        title="Encerrar acordo?"
        body="Corpo"
        confirmText="Encerrar acordo"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
