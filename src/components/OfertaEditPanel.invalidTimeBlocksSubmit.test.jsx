import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OfertaEditPanel from './OfertaEditPanel';
import { updateOferta } from '../services/OfertaService';

vi.mock('../services/OfertaService', () => ({
  updateOferta: vi.fn(),
}));

vi.mock('../hooks/useAutocomplete', () => ({
  useAutocomplete: () => ({
    suggestions: [],
    loading: false,
    error: null,
    errorKind: null,
    resolvedInput: null,
    fetchPredictions: vi.fn(),
    retryLastFetch: vi.fn(),
    selectPlace: vi.fn(),
    clearSuggestions: vi.fn(),
  }),
}));

const ofertaFixa = {
  id: 'of-1',
  modo_preco: 'POR_PASSAGEIRO',
  valor_mensal_ask_kz: 40000,
  flexibilidade_rota: false,
  origin_name: 'Talatona',
  origin_lat: -8.9,
  origin_lng: 13.2,
  destination_name: 'Maianga',
  destination_lat: -8.8,
  destination_lng: 13.23,
  departure_time: '07:00',
  return_time: '17:45',
  dias_semana: [1, 2, 3, 4, 5],
  vagas_disponiveis: 3,
  vagas_totais: 3,
};

describe('OfertaEditPanel — hora inválida bloqueia submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('não abre confirm nem chama updateOferta com Regresso inválido', () => {
    render(
      <OfertaEditPanel
        oferta={ofertaFixa}
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );

    const regresso = screen.getByLabelText(/Hora de regresso/i);
    fireEvent.focus(regresso);
    fireEvent.change(regresso, { target: { value: '99:99' } });
    fireEvent.blur(regresso);

    const guardar = screen.getByRole('button', { name: /Guardar alterações/i });
    expect(guardar).toBeDisabled();

    fireEvent.click(guardar);
    expect(screen.queryByTestId('oferta-edit-snapshot-confirm')).not.toBeInTheDocument();
    expect(updateOferta).not.toHaveBeenCalled();
  });
});
