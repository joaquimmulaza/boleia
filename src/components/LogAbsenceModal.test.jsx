import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import LogAbsenceModal from './LogAbsenceModal';
import { expectNoUserFacingJargon } from '../test/jargonBan';
import {
  FALTA_DATA_HELP_MOTORISTA,
  FALTA_DATA_HELP_PASSAGEIRO,
  FALTA_DATA_INLINE_ERRO_DIA,
} from '../copy/faltasLogAbsenceCopy.js';

describe('LogAbsenceModal — meia quota', () => {
  it('mostra trajeto em falta e copy de meia quota sem divisores fixos', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        quotaMensalKz={30000}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );
    expect(screen.getByRole('radio', { name: /Só ida \(meia quota\)/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Só regresso \(meia quota\)/i })).toBeInTheDocument();
    expect(screen.getByTestId('falta-desconto-help')).toHaveTextContent(/meia quota/i);
    expect(screen.getByTestId('falta-desconto-help')).not.toHaveTextContent(/divisores fixos/i);
    expect(screen.getByTestId('sheet-drag-handle')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Fechar$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('falta-dia-2026-10-02'));
    expect(screen.getByTestId('falta-desconto-dia')).toHaveTextContent('1363,64 Kz');
    expect(screen.queryByText(/2 500/)).not.toBeInTheDocument();
    expect(screen.queryByText(/justa causa/i)).not.toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
    vi.useRealTimers();
  });

  it('actualiza o desconto deste dia antes de guardar', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        quotaMensalKz={30000}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );
    fireEvent.click(screen.getByTestId('falta-dia-2026-10-02'));
    fireEvent.click(screen.getByRole('radio', { name: /Só ida \(meia quota\)/i }));
    expect(screen.getByTestId('falta-desconto-dia')).toHaveTextContent('681,82 Kz');
    vi.useRealTimers();
  });

  it('submete viagem escolhida (só regresso)', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        quotaMensalKz={30000}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );
    fireEvent.click(screen.getByTestId('falta-dia-2026-10-02'));
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

  it('domingo desactivado e segunda activa no calendário (Seg–Sex)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );
    expect(screen.getByTestId('falta-dia-2026-10-04')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-05')).not.toBeDisabled();
    vi.useRealTimers();
  });

  it('desactiva sábado no calendário (motorista)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );
    expect(screen.getByTestId('falta-dia-2026-10-02')).not.toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-03')).toBeDisabled();
    vi.useRealTimers();
  });

  it('motorista: ontem activo no calendário', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={onSubmit} tipoPerfil="Motorista" diasSemanaAcordo={[1, 2, 3, 4, 5]} />,
    );
    fireEvent.click(screen.getByTestId('falta-dia-2026-10-05'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ dataFalta: '2026-10-05' }),
    );
    vi.useRealTimers();
  });

  it('bloqueia tipo Passageiro na sessão de passageiro', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T20:59:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Passageiro"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );

    expect(screen.getByTestId('falta-tipo-locked')).toHaveTextContent('Passageiro');
    expect(screen.queryByRole('combobox', { name: /Tipo/i })).not.toBeInTheDocument();
    expect(screen.getByTestId('falta-data-help')).toHaveTextContent(FALTA_DATA_HELP_PASSAGEIRO);

    fireEvent.click(screen.getByTestId('falta-dia-2026-10-16'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'Passageiro',
        dataFalta: '2026-10-16',
      }),
    );
    vi.useRealTimers();
  });

  it('passageiro 21:59 Luanda: amanhã activo', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T20:59:00Z'));

    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Passageiro"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );

    expect(screen.getByTestId('falta-dia-2026-10-15')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-16')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('falta-dia-2026-10-16'));
    expect(screen.getByTestId('falta-chip-prevista')).toHaveTextContent('Prevista');
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ dataFalta: '2026-10-16' }),
    );

    vi.useRealTimers();
  });

  it('passageiro 22:00 Luanda: amanhã desactivado, depois de amanhã activo', () => {
    const onSubmit = vi.fn();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T21:00:00Z'));

    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Passageiro"
        onClose={vi.fn()}
        onSubmit={onSubmit}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );

    expect(screen.getByTestId('falta-dia-2026-10-16')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-17')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-19')).not.toBeDisabled();

    fireEvent.click(screen.getByTestId('falta-dia-2026-10-19'));
    fireEvent.click(screen.getByRole('button', { name: /Guardar/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ dataFalta: '2026-10-19' }),
    );

    vi.useRealTimers();
  });

  it('motorista mostra help de dias de viagem', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T20:59:00Z'));
    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} tipoPerfil="Motorista" diasSemanaAcordo={[1, 2, 3, 4, 5]} />,
    );
    expect(screen.getByTestId('falta-data-help')).toHaveTextContent(FALTA_DATA_HELP_MOTORISTA);
    expect(screen.queryByText(FALTA_DATA_HELP_PASSAGEIRO)).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('desactiva segunda-feira com acordo Ter–Sex', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00Z'));
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        diasSemanaAcordo={[2, 3, 4, 5]}
      />,
    );
    expect(screen.getByTestId('falta-dia-2026-10-05')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-06')).not.toBeDisabled();
    vi.useRealTimers();
  });

  it('erro inline liga aria-describedby (picker)', () => {
    render(
      <LogAbsenceModal
        isOpen
        tipoPerfil="Motorista"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        diasSemanaAcordo={[1, 2, 3, 4, 5]}
      />,
    );
    expect(screen.getByTestId('falta-agreement-date-picker')).toHaveAttribute(
      'aria-describedby',
      'dataFalta-help',
    );
    expect(FALTA_DATA_INLINE_ERRO_DIA).toContain('Neste dia não há viagem');
  });

  it('desactiva Guardar sem tipoPerfil conhecido', () => {
    render(
      <LogAbsenceModal isOpen onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(screen.getByTestId('modal-registar-falta')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guardar/i })).toBeDisabled();
  });

  it('motorista limita dias futuros no calendário', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T12:00:00Z'));

    render(
      <LogAbsenceModal isOpen tipoPerfil="Motorista" onClose={vi.fn()} onSubmit={vi.fn()} diasSemanaAcordo={[1, 2, 3, 4, 5]} />,
    );

    expect(screen.getByTestId('falta-dia-2026-10-01')).not.toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-02')).toBeDisabled();

    vi.useRealTimers();
  });
});
