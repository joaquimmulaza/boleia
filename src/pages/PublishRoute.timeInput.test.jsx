import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PublishRoute from './PublishRoute';
import { createOferta } from '../services/OfertaService';
import { useHasVehicle } from '../hooks/useHasVehicle';

vi.mock('../services/OfertaService', () => ({
  createOferta: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../hooks/useHasVehicle', () => ({
  useHasVehicle: vi.fn(),
}));

vi.mock('../services/LocationService', () => ({
  getPlacePredictions: vi.fn().mockResolvedValue([]),
  getPlaceDetails: vi.fn().mockResolvedValue({ lat: -8.839, lng: 13.289 }),
}));

vi.mock('../components/AddressInput', () => ({
  default: ({ name, label, onChange, onSelectCoordinates }) => (
    <div>
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        onChange={(e) => {
          onChange(e);
          if (onSelectCoordinates && e.target.value.length > 2) {
            onSelectCoordinates({ lat: -8.839, lng: 13.289 });
          }
        }}
      />
    </div>
  ),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  },
}));

describe('PublishRoute — TimeInput 24h', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHasVehicle.mockReturnValue({ hasVehicle: true, loading: false, error: null, retry: vi.fn() });
  });

  const fillExceptTimes = () => {
    fireEvent.change(document.querySelector('input[name="origin_name"]'), {
      target: { value: 'Talatona' },
    });
    fireEvent.change(document.querySelector('input[name="destination_name"]'), {
      target: { value: 'Mutual' },
    });
    fireEvent.change(document.querySelector('input[name="valor_mensal_ask_kz"]'), {
      target: { value: '40000' },
    });
  };

  const typeTime = (labelRe, digits) => {
    const input = screen.getByLabelText(labelRe);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: digits } });
    fireEvent.blur(input);
    return input;
  };

  it('Ida e Regresso mostram HH:MM 24h no DOM (17:45, não 05:45)', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <PublishRoute />
        </MemoryRouter>,
      );
    });

    typeTime(/Hora de ida/i, '0700');
    const regresso = typeTime(/Hora de regresso/i, '1745');

    expect(screen.getByLabelText(/Hora de ida/i)).toHaveValue('07:00');
    expect(regresso).toHaveValue('17:45');
  });

  it('limpar Regresso opcional emite string vazia no estado (createOferta return_time null)', async () => {
    createOferta.mockResolvedValue({ id: 'of-1' });

    await act(async () => {
      render(
        <MemoryRouter>
          <PublishRoute />
        </MemoryRouter>,
      );
    });

    fillExceptTimes();
    typeTime(/Hora de ida/i, '0715');
    typeTime(/Hora de regresso/i, '1745');

    const regresso = screen.getByLabelText(/Hora de regresso/i);
    fireEvent.focus(regresso);
    fireEvent.change(regresso, { target: { value: '' } });
    fireEvent.blur(regresso);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Publicar oferta/i }));
    });

    await waitFor(() => {
      expect(createOferta).toHaveBeenCalledWith(
        expect.objectContaining({
          departure_time: '07:15',
          return_time: null,
        }),
      );
    });
  });

  it('não submete createOferta com hora de ida inválida', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <PublishRoute />
        </MemoryRouter>,
      );
    });

    fillExceptTimes();
    typeTime(/Hora de ida/i, '99:99');

    const publicar = screen.getByRole('button', { name: /Publicar oferta/i });
    expect(publicar).toBeDisabled();

    await act(async () => {
      fireEvent.click(publicar);
    });

    expect(createOferta).not.toHaveBeenCalled();
  });
});
