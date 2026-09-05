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

  const fillRequiredFields = () => {
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
  };

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

  it('mostra dias Seg–Sex seleccionados por omissão e toggle Oferta flexível', async () => {
    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    expect(screen.getByRole('group', { name: /Dias da semana/i })).toBeInTheDocument();
    for (const dia of ['Seg', 'Ter', 'Qua', 'Qui', 'Sex']) {
      expect(screen.getByRole('button', { name: dia })).toHaveAttribute('aria-pressed', 'true');
    }
    expect(screen.getByRole('button', { name: 'Sáb' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Dom' })).toHaveAttribute('aria-pressed', 'false');

    const flexToggle = screen.getByRole('checkbox', { name: /Oferta flexível/i });
    expect(flexToggle).not.toBeChecked();
  });

  it('submete createOferta com POR_PASSAGEIRO, dias Seg–Sex e flexibilidade desligada', async () => {
    createOferta.mockResolvedValue({ id: 'of-1' });

    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    fillRequiredFields();

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
          dias_semana: [1, 2, 3, 4, 5],
          flexibilidade_rota: false,
        }),
      );
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Oferta publicada/i);
  });

  it('inclui flexibilidade_rota e dias alterados no payload createOferta', async () => {
    createOferta.mockResolvedValue({ id: 'of-1' });

    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sex' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sáb' }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Oferta flexível/i }));

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
          dias_semana: [1, 2, 3, 4, 6],
          flexibilidade_rota: true,
          origin_name: null,
          origin_lat: null,
          destination_name: null,
          destination_lat: null,
        }),
      );
    });
  });

  it('oferta fixa sem OD mostra erro; flexível publica sem origem/destino', async () => {
    createOferta.mockResolvedValue({ id: 'of-flex' });

    await act(async () => {
      renderWithRouter(<PublishRoute />);
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

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Seleccione origem e destino/i,
    );
    expect(createOferta).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox', { name: /Oferta flexível/i }));
    expect(screen.queryByLabelText(/Origem/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Destino/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/capacidade, dias e horário — sem rota origem\/destino fixa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/residência não limita/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Publicar oferta/i }));
    });

    await waitFor(() => {
      expect(createOferta).toHaveBeenCalledWith(
        expect.objectContaining({
          flexibilidade_rota: true,
          origin_name: null,
          destination_name: null,
          departure_time: '07:15',
          valor_mensal_ask_kz: 40000,
        }),
      );
    });
  });

  it('permite alternar para Total do acordo', async () => {
    createOferta.mockResolvedValue({ id: 'of-1' });

    await act(async () => {
      renderWithRouter(<PublishRoute />);
    });

    fireEvent.click(screen.getByRole('button', { name: /Total do acordo/i }));
    fillRequiredFields();
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
          dias_semana: [1, 2, 3, 4, 5],
          flexibilidade_rota: false,
        }),
      );
    });
  });
});
