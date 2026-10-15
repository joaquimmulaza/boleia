import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeInput, { TIME_INPUT_ERROR_TEST_ID } from './TimeInput';
import { ADDRESS_INPUT_SURFACE_CLASS } from '../utils/addressInputSurface.js';
import { TIME_INPUT_INVALID_MESSAGE } from '../utils/timeInputMask.js';

describe('TimeInput', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('usa input texto HH:MM (não type=time), inputMode numeric e placeholder 17:45', () => {
    render(
      <TimeInput
        name="preferred_time"
        value="07:15"
        onChange={vi.fn()}
        aria-label="Hora preferida"
      />,
    );

    const input = screen.getByLabelText('Hora preferida');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputMode', 'numeric');
    expect(input).toHaveAttribute('placeholder', '17:45');
    expect(input).toHaveValue('07:15');
    expect(input).toHaveClass('time-input-24h');
    expect(input.className).toMatch(/\bh-11\b/);
    expect(input.className).not.toMatch(/min-w-/);
    expect(indexCss).toMatch(/\.time-input-24h\s*\{[^}]*min-width:\s*6\.75rem/s);
    expect(input.className).toMatch(/border-\[#718096\]/);
    ADDRESS_INPUT_SURFACE_CLASS.split(/\s+/).filter((token) => token && token !== 'h-14').forEach((token) => {
      expect(input.className).toContain(token);
    });
  });

  it('máscara e onChange em HH:MM válido ao digitar 1745', () => {
    const onChange = vi.fn();
    render(
      <TimeInput
        name="return_time"
        value=""
        onChange={onChange}
        aria-label="Hora de regresso"
      />,
    );

    const input = screen.getByLabelText(/Hora de regresso/i);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '1745' } });
    expect(input).toHaveValue('17:45');
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0].target.value).toBe('17:45');
  });

  it('mostra erro inline para hora inválida no blur', () => {
    render(
      <TimeInput
        name="return_time"
        value=""
        onChange={vi.fn()}
        aria-label="Hora de regresso"
      />,
    );

    const input = screen.getByLabelText(/Hora de regresso/i);
    fireEvent.change(input, { target: { value: '25:00' } });
    fireEvent.blur(input);
    expect(screen.getByTestId(TIME_INPUT_ERROR_TEST_ID)).toHaveTextContent(
      TIME_INPUT_INVALID_MESSAGE,
    );
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
