import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeInput, { TIME_INPUT_ERROR_TEST_ID } from './TimeInput';
import { TIME_INPUT_INVALID_MESSAGE } from '../utils/timeInputMask.js';

describe('TimeInput — hora inválida mantém texto digitado', () => {
  it('no blur mantém 25:00 visível (não reverte para valor anterior) e marca inválido', () => {
    const onValidityChange = vi.fn();
    render(
      <TimeInput
        name="departure_time"
        value="07:00"
        onChange={vi.fn()}
        onValidityChange={onValidityChange}
        required
        aria-label="Hora de ida"
      />,
    );

    const input = screen.getByLabelText(/Hora de ida/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '25:00' } });
    fireEvent.blur(input);

    expect(input).toHaveValue('25:00');
    expect(screen.getByTestId(TIME_INPUT_ERROR_TEST_ID)).toHaveTextContent(
      TIME_INPUT_INVALID_MESSAGE,
    );
    expect(onValidityChange).toHaveBeenCalledWith(false);
  });
});
