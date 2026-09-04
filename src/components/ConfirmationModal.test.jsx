import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmationModal from './ConfirmationModal';

describe('ConfirmationModal', () => {
  it('não renderiza quando isOpen é false', () => {
    const { container } = render(
      <ConfirmationModal
        isOpen={false}
        title="Título"
        message="Mensagem"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('com busy: desactiva confirmar/cancelar e ignora clique no overlay', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationModal
        isOpen
        busy
        title="Sair do acordo?"
        message="Confirma?"
        confirmText="Sair"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    const confirmBtn = screen.getByRole('button', { name: /^Sair$/i });
    const cancelBtn = screen.getByRole('button', { name: /Voltar/i });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    fireEvent.click(confirmBtn);
    fireEvent.click(cancelBtn);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    const overlay = document.querySelector('[aria-hidden="true"]');
    fireEvent.click(overlay);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('sem busy: confirma, cancela e overlay disparam callbacks', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmationModal
        isOpen
        title="Confirmar?"
        message="Ok?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Confirmar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(document.querySelector('[aria-hidden="true"]'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
