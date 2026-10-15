import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeInput from './TimeInput';
import { ADDRESS_INPUT_SURFACE_CLASS } from '../utils/addressInputSurface.js';

describe('TimeInput', () => {
  it('usa type=time com lang pt-PT e classe 24h', () => {
    render(
      <TimeInput
        name="preferred_time"
        value="07:15"
        onChange={vi.fn()}
        aria-label="Hora preferida"
      />,
    );

    const input = screen.getByLabelText('Hora preferida');
    expect(input).toHaveAttribute('type', 'time');
    expect(input).toHaveAttribute('lang', 'pt-PT');
    expect(input).toHaveClass('time-input-24h');
    expect(input).toHaveAttribute('step', '60');
    expect(input.className).toMatch(/bg-background/);
    expect(input.className).toMatch(/border-\[#718096\]/);
    ADDRESS_INPUT_SURFACE_CLASS.split(/\s+/).forEach((token) => {
      if (token) expect(input.className).toContain(token);
    });
  });
});
