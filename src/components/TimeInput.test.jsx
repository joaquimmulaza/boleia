import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeInput from './TimeInput';
import { ADDRESS_INPUT_SURFACE_CLASS } from '../utils/addressInputSurface.js';

describe('TimeInput', () => {
  const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

  it('usa type=time com lang pt-PT e classe 24h (min-width só em CSS)', () => {
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
    expect(input.className).not.toMatch(/min-w-/);
    expect(indexCss).toMatch(/\.time-input-24h\s*\{[^}]*min-width:\s*6\.75rem/s);
    expect(input.className).toMatch(/border-\[#718096\]/);
    ADDRESS_INPUT_SURFACE_CLASS.split(/\s+/).forEach((token) => {
      if (token) expect(input.className).toContain(token);
    });
  });
});
