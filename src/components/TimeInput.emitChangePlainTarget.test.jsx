import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeInput from './TimeInput';

describe('TimeInput — emitChange', () => {
  it('onChange recebe evento sintético com target plano (name, id, value)', () => {
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

    const event = onChange.mock.calls.at(-1)[0];
    expect(event.type).toBe('change');
    expect(Object.keys(event.target).sort()).toEqual(['id', 'name', 'value']);
    expect(event.target.name).toBe('return_time');
    expect(event.target.value).toBe('17:45');
  });
});
