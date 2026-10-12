import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddressInput from './AddressInput';
import {
  EMPTY_GEOCODER_MESSAGE,
  formatUseFreeTextLabel,
} from '../utils/addressGeocoderCopy';

const fetchPredictions = vi.fn();
const selectPlace = vi.fn();
const clearSuggestions = vi.fn();
let mockSuggestions = [];
let mockLoading = false;

vi.mock('../hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    suggestions: mockSuggestions,
    loading: mockLoading,
    error: null,
    fetchPredictions,
    selectPlace,
    clearSuggestions,
  }),
}));

describe('AddressInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestions = [];
    mockLoading = false;
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

  it('origem e destino usam o mesmo debounce de autocomplete', async () => {
    vi.useFakeTimers();
    render(
      <>
        <AddressInput name="origin_name" label="Origem" value="" onChange={vi.fn()} />
        <AddressInput name="destination_name" label="Destino" value="" onChange={vi.fn()} />
      </>,
    );

    fireEvent.change(screen.getByLabelText(/^Origem$/i), { target: { value: 'Via' } });
    fireEvent.change(screen.getByLabelText(/^Destino$/i), { target: { value: 'Tal' } });

    expect(fetchPredictions).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);

    expect(fetchPredictions).toHaveBeenCalledWith('Via');
    expect(fetchPredictions).toHaveBeenCalledWith('Tal');
    vi.useRealTimers();
  });

  it('limpa coordenadas ao editar texto (texto livre sem inventar lat/lng)', () => {
    const onSelectCoordinates = vi.fn();
    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value="Talatona"
        onChange={vi.fn()}
        onSelectCoordinates={onSelectCoordinates}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Origem$/i), {
      target: { value: 'Endereço sem geocode' },
    });

    expect(onSelectCoordinates).toHaveBeenCalledWith(null);
  });

  it('mostra copy aprovada e acção Usar quando a lista vem vazia', () => {
    mockSuggestions = [];
    mockLoading = false;

    render(
      <AddressInput
        name="destination_name"
        label="Destino"
        value="XYZZZZ"
        onChange={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByLabelText(/^Destino$/i));

    expect(screen.getByText(EMPTY_GEOCODER_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: formatUseFreeTextLabel('XYZZZZ') }),
    ).toBeInTheDocument();
  });

  it('Usar texto livre fecha sugestões e mantém coordenadas nulas', () => {
    mockSuggestions = [];
    mockLoading = false;
    const onSelectCoordinates = vi.fn();

    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value="Bairro QA"
        onChange={vi.fn()}
        onSelectCoordinates={onSelectCoordinates}
      />,
    );

    fireEvent.focus(screen.getByLabelText(/^Origem$/i));
    fireEvent.click(
      screen.getByRole('button', { name: formatUseFreeTextLabel('Bairro QA') }),
    );

    expect(onSelectCoordinates).toHaveBeenCalledWith(null);
    expect(screen.queryByText(EMPTY_GEOCODER_MESSAGE)).not.toBeInTheDocument();
  });

});
