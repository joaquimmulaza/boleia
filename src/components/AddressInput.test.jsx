import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddressInput from './AddressInput';

vi.mock('../hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    suggestions: [],
    loading: false,
    error: null,
    fetchPredictions: vi.fn(),
    selectPlace: vi.fn(),
    clearSuggestions: vi.fn(),
  }),
}));

describe('AddressInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza com atributo required por defeito', () => {
    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value=""
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox', { name: /Origem/i });
    expect(input).toBeRequired();
  });

  it('permite definir required={false} para campos opcionais', () => {
    render(
      <AddressInput
        name="pickup_name"
        label="Ponto de recolha (opcional)"
        required={false}
        value=""
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('textbox', { name: /Ponto de recolha \(opcional\)/i });
    expect(input).not.toBeRequired();
  });

  it('associa label ao input usando id ou fallback para name', () => {
    const { rerender } = render(
      <AddressInput
        name="pickup_name"
        label="Ponto de recolha (opcional)"
        value=""
        onChange={vi.fn()}
      />,
    );

    const inputFallback = screen.getByLabelText(/Ponto de recolha \(opcional\)/i);
    expect(inputFallback).toHaveAttribute('id', 'pickup_name');

    rerender(
      <AddressInput
        id="custom_pickup_id"
        name="pickup_name"
        label="Ponto de recolha (opcional)"
        value=""
        onChange={vi.fn()}
      />,
    );

    const inputCustom = screen.getByLabelText(/Ponto de recolha \(opcional\)/i);
    expect(inputCustom).toHaveAttribute('id', 'custom_pickup_id');
  });

  it('notifica alterações através do onChange', () => {
    const onChange = vi.fn();
    render(
      <AddressInput
        name="pickup_name"
        label="Ponto de recolha (opcional)"
        required={false}
        value=""
        onChange={onChange}
      />,
    );

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Mutamba' } });

    expect(onChange).toHaveBeenCalledWith({
      target: { name: 'pickup_name', value: 'Mutamba' },
    });
  });
});
