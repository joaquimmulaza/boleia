import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TerminateAgreementModal from './TerminateAgreementModal';

function renderModal(props = {}) {
  const onConfirm = props.onConfirm || vi.fn();
  const onCancel = props.onCancel || vi.fn();
  const view = render(
    <TerminateAgreementModal
      isOpen
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...props}
    />,
  );
  return { ...view, onConfirm, onCancel };
}

describe('TerminateAgreementModal', () => {
  it('não renderiza quando isOpen é false', () => {
    const { container } = render(
      <TerminateAgreementModal
        isOpen={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('apresenta as 3 opções com copy modeless em português', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: /Rescindir acordo/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    expect(within(dialog).getByRole('radio', { name: /Aviso prévio/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/continua activ[oa] até ao último dia deste mês/i)).toBeInTheDocument();

    expect(
      within(dialog).getByRole('radio', { name: /acordo das duas partes|consensual/i }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/confirmação da outra parte/i)).toBeInTheDocument();

    expect(within(dialog).getByRole('radio', { name: /Justa causa/i })).toBeInTheDocument();
    expect(within(dialog).queryByText(/pro-rata|pró-rata|N_contrato|POR_PASSAGEIRO/i)).not.toBeInTheDocument();
  });

  it('desactiva o CTA destrutivo até haver um modo válido', () => {
    renderModal();

    const confirm = screen.getByRole('button', { name: /Confirmar rescisão/i });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByRole('radio', { name: /Aviso prévio/i }));
    expect(confirm).toBeEnabled();
  });

  it('em justa causa exige motivo do conjunto e não mostra textarea nem preview de valores', () => {
    renderModal();

    fireEvent.click(screen.getByRole('radio', { name: /Justa causa/i }));

    const confirm = screen.getByRole('button', { name: /Confirmar rescisão/i });
    expect(confirm).toBeDisabled();

    const motivo = screen.getByRole('combobox', { name: /^Motivo$/i });
    expect(motivo.tagName).toBe('SELECT');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/quota|pro-rata|Kz/i)).not.toBeInTheDocument();

    fireEvent.change(motivo, { target: { value: 'faltas_excessivas' } });
    expect(confirm).toBeEnabled();
    expect(screen.getByRole('option', { name: /Faltas em excesso/i }).selected).toBe(true);
    expect(screen.getByRole('option', { name: /Avaria do veículo/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /segurança/i })).toBeInTheDocument();
  });

  it('confirma aviso prévio sem justificativa', () => {
    const { onConfirm } = renderModal();

    fireEvent.click(screen.getByRole('radio', { name: /Aviso prévio/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rescisão/i }));

    expect(onConfirm).toHaveBeenCalledWith({ modo: 'aviso_previo' });
  });

  it('confirma justa causa com justificativa do enum', () => {
    const { onConfirm } = renderModal();

    fireEvent.click(screen.getByRole('radio', { name: /Justa causa/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /^Motivo$/i }), {
      target: { value: 'avaria_veiculo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rescisão/i }));

    expect(onConfirm).toHaveBeenCalledWith({
      modo: 'justa_causa',
      justificativa: 'avaria_veiculo',
    });
  });

  it('separa o CTA destrutivo do Cancelar e nunca o foca por omissão', () => {
    renderModal();

    const dialog = screen.getByRole('dialog', { name: /Rescindir acordo/i });
    const cancelar = within(dialog).getByRole('button', { name: /^Cancelar$/i });
    const confirmar = within(dialog).getByRole('button', { name: /Confirmar rescisão/i });

    expect(cancelar.compareDocumentPosition(confirmar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(confirmar.className).toMatch(/bg-destructive|bg-coral|bg-red-/);
    expect(document.activeElement).not.toBe(confirmar);
  });

  it('com busy: desactiva acções e ignora overlay', () => {
    const { onConfirm, onCancel } = renderModal({ busy: true });

    fireEvent.click(screen.getByRole('radio', { name: /Aviso prévio/i }));
    const confirm = screen.getByRole('button', { name: /Confirmar rescisão/i });
    const cancel = screen.getByRole('button', { name: /^Cancelar$/i });
    expect(confirm).toBeDisabled();
    expect(cancel).toBeDisabled();

    fireEvent.click(confirm);
    fireEvent.click(cancel);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector('[aria-hidden="true"]'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Cancelar e overlay chamam onCancel', () => {
    const { onCancel } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /^Cancelar$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(document.querySelector('[aria-hidden="true"]'));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('mostra FeedbackAlert de erro dentro do dialog acima dos CTAs', () => {
    renderModal({ error: 'Sem permissão para rescindir este acordo.' });

    const dialog = screen.getByRole('dialog', { name: /Rescindir acordo/i });
    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent(/Sem permissão para rescindir este acordo/i);
    expect(alert).toHaveAttribute('data-variant', 'error');

    const cancelar = within(dialog).getByRole('button', { name: /^Cancelar$/i });
    expect(alert.compareDocumentPosition(cancelar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sem error não mostra alerta no dialog', () => {
    renderModal();
    const dialog = screen.getByRole('dialog', { name: /Rescindir acordo/i });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});
