import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogAbsenceModal from './LogAbsenceModal';
import { expectNoUserFacingJargon } from '../test/jargonBan';

describe('LogAbsenceModal — meia quota', () => {
  it('mostra selector de trajeto e copy de meia quota', () => {
    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId('falta-viagem-select')).toBeInTheDocument();
    expect(screen.getByTestId('falta-desconto-help')).toHaveTextContent(/meia quota/i);
    expect(screen.getByRole('option', { name: /Só ida/i })).toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });

  it('submete viagem escolhida (só regresso)', () => {
    const onSubmit = vi.fn();
    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    fireEvent.change(screen.getByLabelText(/Data/i), {
      target: { value: '2026-09-07' },
    });
    fireEvent.change(screen.getByTestId('falta-viagem-select'), {
      target: { value: 'regresso' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        dataFalta: '2026-09-07',
        viagem: 'regresso',
        tipo: 'Motorista',
      }),
    );
  });

  it('bloqueia tipo Passageiro na sessão de passageiro', () => {
    const onSubmit = vi.fn();
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Passageiro"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByTestId('falta-tipo-locked')).toHaveTextContent('Passageiro');
    expect(screen.queryByRole('combobox', { name: /Tipo/i })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Data/i), {
      target: { value: '2026-09-07' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'Passageiro',
      }),
    );
  });

  it('limita data a hoje ou anterior (sem datas futuras)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));

    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByLabelText(/Data/i)).toHaveAttribute('max', '2026-10-01');

    vi.useRealTimers();
  });
});
