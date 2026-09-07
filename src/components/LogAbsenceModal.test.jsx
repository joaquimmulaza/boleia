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
      }),
    );
  });
});
