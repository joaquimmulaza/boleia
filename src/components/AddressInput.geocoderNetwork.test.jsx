import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AddressInput from './AddressInput';
import { formatUseFreeTextLabel } from '../utils/addressGeocoderCopy';

const getPlacePredictions = vi.fn();
const getPlaceDetails = vi.fn();

vi.mock('../services/LocationService', () => ({
  getPlacePredictions: (...args) => getPlacePredictions(...args),
  getPlaceDetails: (...args) => getPlaceDetails(...args),
}));

describe('AddressInput — erro de rede Photon (B8 UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlaceDetails.mockResolvedValue(null);
  });

  it('429: mostra estado de erro de rede v1.3 após pesquisa concluída', async () => {
    vi.useFakeTimers();
    getPlacePredictions.mockRejectedValueOnce(
      Object.assign(new Error('Photon respondeu com status 429'), {
        status: 429,
        errorKind: 'network',
      }),
    );

    render(
      <AddressInput
        name="origin_name"
        label="Origem"
        value=""
        onChange={vi.fn()}
        allowFreeTextUse
      />,
    );

    const input = screen.getByRole('combobox', { name: /Origem/i });
    fireEvent.change(input, { target: { value: 'Talatona' } });
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId('geocoder-network-error')).toBeInTheDocument();
    });
    expect(screen.getByText(
      'Não foi possível procurar locais. Verifica a ligação e tenta outra vez.',
    )).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: formatUseFreeTextLabel('Talatona') }),
    ).toBeInTheDocument();
  });

  it('503: mostra estado de erro de rede v1.3 após pesquisa concluída', async () => {
    vi.useFakeTimers();
    getPlacePredictions.mockRejectedValueOnce(
      Object.assign(new Error('Photon respondeu com status 503'), {
        status: 503,
        errorKind: 'network',
      }),
    );

    render(
      <AddressInput
        name="destination_name"
        label="Destino"
        value=""
        onChange={vi.fn()}
        allowFreeTextUse
      />,
    );

    const input = screen.getByRole('combobox', { name: /Destino/i });
    fireEvent.change(input, { target: { value: 'Viana' } });
    await vi.advanceTimersByTimeAsync(300);
    vi.useRealTimers();

    await waitFor(() => {
      expect(screen.getByTestId('geocoder-network-error')).toBeInTheDocument();
    });
  });
});
