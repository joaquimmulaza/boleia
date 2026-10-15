import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FaltaAgreementDatePicker from './FaltaAgreementDatePicker';

describe('FaltaAgreementDatePicker', () => {
  it('domingo desactivado e segunda activa (ISO Seg–Sex)', () => {
    render(
      <FaltaAgreementDatePicker
        id="dataFalta"
        value=""
        onChange={vi.fn()}
        min="2026-10-01"
        max="2026-10-31"
        diasSemana={[1, 2, 3, 4, 5]}
        initialMonth="2026-10-01"
      />,
    );
    expect(screen.getByTestId('falta-dia-2026-10-04')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-05')).not.toBeDisabled();
  });

  it('desactiva sábado e domingo com acordo Seg–Sex', () => {
    render(
      <FaltaAgreementDatePicker
        id="dataFalta"
        value=""
        onChange={vi.fn()}
        min="2026-10-01"
        max="2026-10-31"
        diasSemana={[1, 2, 3, 4, 5]}
        initialMonth="2026-10-01"
      />,
    );
    expect(screen.getByTestId('falta-dia-2026-10-10')).toBeDisabled();
    expect(screen.getByTestId('falta-dia-2026-10-09')).not.toBeDisabled();
  });

  it('liga aria-describedby ao erro quando hasError', () => {
    render(
      <FaltaAgreementDatePicker
        id="dataFalta"
        value=""
        onChange={vi.fn()}
        min="2026-10-01"
        diasSemana={[1, 2, 3, 4, 5]}
        describedBy="dataFalta-help"
        errorId="dataFalta-error"
        hasError
        initialMonth="2026-10-01"
      />,
    );
    expect(screen.getByTestId('falta-agreement-date-picker')).toHaveAttribute(
      'aria-describedby',
      'dataFalta-help dataFalta-error',
    );
  });

  it('selecciona dia activo', () => {
    const onChange = vi.fn();
    render(
      <FaltaAgreementDatePicker
        id="dataFalta"
        value=""
        onChange={onChange}
        min="2026-10-01"
        max="2026-10-31"
        diasSemana={[1, 2, 3, 4, 5]}
        initialMonth="2026-10-01"
      />,
    );
    fireEvent.click(screen.getByTestId('falta-dia-2026-10-09'));
    expect(onChange).toHaveBeenCalledWith('2026-10-09');
  });
});
