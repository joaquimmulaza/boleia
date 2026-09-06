import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
  it('por defeito o input é required (OD procura/oferta)', () => {
    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value=""
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('textbox')).toBeRequired();
  });

  it('com required={false} o input não bloqueia formulário HTML5', () => {
    render(
      <AddressInput
        name="pickup_name"
        label="Ponto de recolha (opcional)"
        value=""
        onChange={vi.fn()}
        required={false}
      />,
    );

    expect(screen.getByRole('textbox')).not.toBeRequired();
  });
});
