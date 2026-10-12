import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
let mockErrorKind = null;
const retryLastFetch = vi.fn();

vi.mock('../hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    suggestions: mockSuggestions,
    loading: mockLoading,
    error: null,
    errorKind: mockErrorKind,
    fetchPredictions,
    retryLastFetch,
    selectPlace,
    clearSuggestions,
  }),
}));

describe('AddressInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSuggestions = [];
    mockLoading = false;
    mockErrorKind = null;
    selectPlace.mockResolvedValue({ lat: -8.838, lng: 13.234 });
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

    const input = screen.getByRole('combobox', { name: /Origem/i });
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

    const input = screen.getByRole('combobox', { name: /Ponto de recolha \(opcional\)/i });
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

    const input = screen.getByRole('combobox');
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

  it('não apaga coordenadas ao editar texto após escolher sugestão', async () => {
    const onSelectCoordinates = vi.fn();
    mockSuggestions = [
      { place_id: 'photon-1', description: 'Talatona, Luanda' },
    ];

    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value=""
        onChange={vi.fn()}
        onSelectCoordinates={onSelectCoordinates}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^Origem$/i), { target: { value: 'Tala' } });
    fireEvent.click(await screen.findByText('Talatona, Luanda'));

    await waitFor(() => {
      expect(onSelectCoordinates).toHaveBeenCalledWith(
        expect.objectContaining({ lat: -8.838, lng: 13.234 }),
      );
    });
    onSelectCoordinates.mockClear();

    fireEvent.change(screen.getByLabelText(/^Origem$/i), {
      target: { value: 'Talatona editado' },
    });

    expect(onSelectCoordinates).not.toHaveBeenCalled();
  });

  it('sem allowFreeTextUse não mostra acção Usar quando a lista vem vazia', () => {
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
      screen.queryByRole('button', { name: formatUseFreeTextLabel('XYZZZZ') }),
    ).not.toBeInTheDocument();
  });

  it('com allowFreeTextUse mostra copy e acção Usar quando a lista vem vazia', () => {
    mockSuggestions = [];
    mockLoading = false;

    render(
      <AddressInput
        name="destination_name"
        label="Destino"
        value="XYZZZZ"
        onChange={vi.fn()}
        allowFreeTextUse
      />,
    );

    fireEvent.focus(screen.getByLabelText(/^Destino$/i));

    expect(screen.getByText(EMPTY_GEOCODER_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: formatUseFreeTextLabel('XYZZZZ') }),
    ).toBeInTheDocument();
  });

  it('Enter com lista aberta selecciona sugestão e não submete o formulário', async () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    mockSuggestions = [
      { place_id: 'photon-1', description: 'Talatona, Luanda' },
      { place_id: 'photon-2', description: 'Viana, Viana' },
    ];

    render(
      <form onSubmit={onSubmit}>
        <AddressInput
          name="origin_name"
          label="Origem"
          value="Tal"
          onChange={vi.fn()}
        />
        <button type="submit">Guardar</button>
      </form>,
    );

    const input = screen.getByRole('combobox', { name: /Origem/i });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(selectPlace).toHaveBeenCalledWith('photon-1');
    });
  });

  it('setas destacam sugestões via aria-activedescendant', () => {
    mockSuggestions = [
      { place_id: 'photon-1', description: 'Talatona, Luanda' },
      { place_id: 'photon-2', description: 'Viana, Viana' },
    ];

    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value="Tal"
        onChange={vi.fn()}
      />,
    );

    const input = screen.getByRole('combobox', { name: /Origem/i });
    fireEvent.focus(input);
    expect(input).toHaveAttribute('aria-activedescendant', 'origin_name-geocoder-listbox-option-0');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', 'origin_name-geocoder-listbox-option-1');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveAttribute('aria-activedescendant', 'origin_name-geocoder-listbox-option-0');
  });

  it('erro de rede mostra painel próprio com tentar novamente', () => {
    mockErrorKind = 'network';
    mockSuggestions = [];

    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value="Tal"
        onChange={vi.fn()}
      />,
    );

    fireEvent.focus(screen.getByRole('combobox', { name: /Origem/i }));
    expect(screen.getByTestId('geocoder-network-error')).toBeInTheDocument();
    expect(screen.queryByTestId('geocoder-empty-state')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(retryLastFetch).toHaveBeenCalled();
  });

  it('Usar texto livre fecha sugestões, confirma free-text e mantém coordenadas nulas', () => {
    mockSuggestions = [];
    mockLoading = false;
    const onSelectCoordinates = vi.fn();
    const onConfirmFreeText = vi.fn();

    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value="Bairro QA"
        onChange={vi.fn()}
        onSelectCoordinates={onSelectCoordinates}
        onConfirmFreeText={onConfirmFreeText}
        allowFreeTextUse
      />,
    );

    fireEvent.focus(screen.getByLabelText(/^Origem$/i));
    fireEvent.click(
      screen.getByRole('button', { name: formatUseFreeTextLabel('Bairro QA') }),
    );

    expect(onConfirmFreeText).toHaveBeenCalled();
    expect(onSelectCoordinates).toHaveBeenCalledWith(null);
    expect(screen.queryByText(EMPTY_GEOCODER_MESSAGE)).not.toBeInTheDocument();
  });

});
