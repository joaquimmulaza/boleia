import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import PublishRoute from './PublishRoute';
import { createOferta } from '../services/OfertaService';

vi.mock('../services/OfertaService', () => ({
  createOferta: vi.fn(),
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

const renderWithRouter = (ui) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('PublishRoute — Publicar oferta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza selector de modo e campos principais', async () => {
    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    expect(screen.getByRole('button', { name: /Por passageiro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Total do acordo/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Origem/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Destino/i)).toBeInTheDocument();
    expect(document.querySelector('input[name="departure_time"]')).toBeInTheDocument();
    expect(document.querySelector('input[name="valor_mensal_ask_kz"]')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar oferta/i })).toBeInTheDocument();
  });

  it('submete createOferta com POR_PASSAGEIRO', async () => {
    createOferta.mockResolvedValue({ id: 'of-1' });

    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    fireEvent.change(document.querySelector('input[name="origin_name"]'), {
      target: { value: 'Talatona' },
    });
    fireEvent.change(document.querySelector('input[name="destination_name"]'), {
      target: { value: 'Mutual' },
    });
    fireEvent.change(document.querySelector('input[name="departure_time"]'), {
      target: { value: '07:15' },
    });
    fireEvent.change(document.querySelector('input[name="valor_mensal_ask_kz"]'), {
      target: { value: '40000' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Publicar oferta/i }));
    });

    await waitFor(() => {
      expect(createOferta).toHaveBeenCalledWith(
        expect.objectContaining({
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 40000,
          origin_name: 'Talatona',
          destination_name: 'Mutual',
          departure_time: '07:15',
        }),
      );
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Oferta publicada/i);
  });

  it('permite alternar para Total do acordo', async () => {
    createOferta.mockResolvedValue({ id: 'of-1' });

    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    fireEvent.click(screen.getByRole('button', { name: /Total do acordo/i }));
    fireEvent.change(document.querySelector('input[name="origin_name"]'), {
      target: { value: 'Talatona' },
    });
    fireEvent.change(document.querySelector('input[name="destination_name"]'), {
      target: { value: 'Mutual' },
    });
    fireEvent.change(document.querySelector('input[name="departure_time"]'), {
      target: { value: '07:15' },
    });
    fireEvent.change(document.querySelector('input[name="valor_mensal_ask_kz"]'), {
      target: { value: '120000' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Publicar oferta/i }));
    });

    await waitFor(() => {
      expect(createOferta).toHaveBeenCalledWith(
        expect.objectContaining({
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 120000,
        }),
      );
    });
  });
});
