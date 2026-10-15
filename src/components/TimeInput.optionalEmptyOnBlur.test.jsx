import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeInput from './TimeInput';

describe('TimeInput — campo opcional vazio no blur', () => {
  it('com valor 17:45, limpar e blur emite onChange com string vazia', () => {
    const onChange = vi.fn();
    render(
      <TimeInput
        name="return_time"
        value="17:45"
        onChange={onChange}
        aria-label="Hora de regresso"
      />,
    );

    const input = screen.getByLabelText(/Hora de regresso/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].target.value).toBe('');
  });
});
