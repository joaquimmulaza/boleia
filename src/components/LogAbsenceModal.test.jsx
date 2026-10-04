import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogAbsenceModal from './LogAbsenceModal';
import { expectNoUserFacingJargon } from '../test/jargonBan';

describe('LogAbsenceModal — meia quota', () => {
  it('mostra trajeto em falta e copy de meia quota sem divisores fixos', () => {
    render(
      <LogAbsenceModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        quotaMensalKz={30000}
        diasUteisMes={22}
      />,
    );
    expect(screen.getByRole('radio', { name: /Só ida \(meia quota\)/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Só regresso \(meia quota\)/i })).toBeInTheDocument();
    expect(screen.getByTestId('falta-desconto-help')).toHaveTextContent(/meia quota/i);
    expect(screen.getByTestId('falta-desconto-help')).not.toHaveTextContent(/divisores fixos/i);
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fechar$/i })).toBeInTheDocument();
    expect(screen.getByTestId('falta-desconto-dia')).toHaveTextContent('1363,64 Kz');
    expect(screen.queryByText(/2 500/)).not.toBeInTheDocument();
    expect(screen.queryByText(/justa causa/i)).not.toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });

  it('actualiza o desconto deste dia antes de guardar', () => {
    render(
      <LogAbsenceModal
        isOpen
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        quotaMensalKz={30000}
        diasUteisMes={22}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /Só ida \(meia quota\)/i }));
    expect(screen.getByTestId('falta-desconto-dia')).toHaveTextContent('681,82 Kz');
  });

  it('submete viagem escolhida (só regresso)', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        onClose={vi.fn()}
        onSubmit={onSubmit}
        quotaMensalKz={30000}
        diasUteisMes={22}
      />,
    );
    fireEvent.change(screen.getByLabelText(/^Data$/i), {
      target: { value: '2026-10-02' },
    });
    fireEvent.click(screen.getByRole('radio', { name: /Só regresso/i }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        dataFalta: '2026-10-02',
        viagem: 'regresso',
        tipo: 'Motorista',
      }),
    );
    vi.useRealTimers();
  });

  it('recusa dia de mês fechado e dia futuro', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={onSubmit} />,
    );
    const data = screen.getByLabelText(/^Data$/i);
    expect(data).toHaveAttribute('min', '2026-10-01');
    expect(data).toHaveAttribute('max', '2026-10-04');

    fireEvent.change(data, { target: { value: '2026-09-30' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.change(data, { target: { value: '2026-10-15' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('bloqueia tipo Passageiro na sessão de passageiro', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
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
    expect(screen.queryByRole('option', { name: 'Motorista' })).not.toBeInTheDocument();
    expect(screen.getByTestId('falta-tipo-locked')).not.toHaveTextContent('Motorista');

    fireEvent.change(screen.getByLabelText(/^Data$/i), {
      target: { value: '2026-10-02' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'Passageiro',
        dataFalta: '2026-10-02',
      }),
    );
    vi.useRealTimers();
  });

  it('limita data a hoje ou anterior (sem datas futuras)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));

    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByLabelText(/^Data$/i)).toHaveAttribute('min', '2026-10-01');
    expect(screen.getByLabelText(/^Data$/i)).toHaveAttribute('max', '2026-10-01');

    vi.useRealTimers();
  });
});
