import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import OfertaEditPanel from './OfertaEditPanel';
import { updateOferta } from '../services/OfertaService';

vi.mock('../services/OfertaService', () => ({
  updateOferta: vi.fn(),
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
  return_time: null,
  dias_semana: [1, 2, 3, 4, 5],
  vagas_disponiveis: 3,
  vagas_totais: 3,
};

describe('OfertaEditPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateOferta.mockResolvedValue({ ...ofertaFixa, departure_time: '08:00' });
  });

  it('mostra confirm snapshot antes de guardar (copy genérica)', async () => {
    const onSaved = vi.fn();
    render(
      <OfertaEditPanel
        oferta={ofertaFixa}
        onCancel={() => {}}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Hora de ida/i), {
      target: { name: 'departure_time', value: '08:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar alterações/i }));

    expect(await screen.findByTestId('oferta-edit-snapshot-confirm')).toBeInTheDocument();
    expect(screen.getByText(/valor negociado das propostas existentes não muda/i)).toBeInTheDocument();
    expect(screen.getByText(/serão invalidadas/i)).toBeInTheDocument();
    expect(updateOferta).not.toHaveBeenCalled();

    fireEvent.click(
      within(screen.getByTestId('oferta-edit-snapshot-confirm')).getByRole('button', {
        name: 'Guardar alterações',
      }),
    );

    await waitFor(() => {
      expect(updateOferta).toHaveBeenCalledWith(
        'of-1',
        expect.objectContaining({ departure_time: '08:00' }),
      );
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it('stepper de lugares trava nos limites min/max do veículo', async () => {
    render(
      <OfertaEditPanel
        oferta={{ ...ofertaFixa, vagas_totais: 4, vagas_disponiveis: 2 }}
        veiculoVagasPassageiros={5}
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/Mínimo 2 \(ocupados\)/)).toBeInTheDocument();

    const menos = screen.getByRole('button', { name: 'Menos lugares' });
    const mais = screen.getByRole('button', { name: 'Mais lugares' });

    fireEvent.click(menos);
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(menos);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(menos).toBeDisabled();

    fireEvent.click(mais);
    fireEvent.click(mais);
    fireEvent.click(mais);
    const lugaresGroup = screen.getByRole('group', { name: 'Lugares na oferta' });
    expect(within(lugaresGroup).getByText('5')).toBeInTheDocument();
    expect(within(lugaresGroup).getByRole('button', { name: 'Mais lugares' })).toBeDisabled();
  });

  it('envia vagas_totais no payload da RPC', async () => {
    render(
      <OfertaEditPanel
        oferta={{ ...ofertaFixa, vagas_totais: 3, vagas_disponiveis: 1 }}
        veiculoVagasPassageiros={6}
        onCancel={() => {}}
        onSaved={() => {}}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mais lugares' }));
    fireEvent.click(screen.getByRole('button', { name: /Guardar alterações/i }));
    fireEvent.click(
      within(await screen.findByTestId('oferta-edit-snapshot-confirm')).getByRole('button', {
        name: 'Guardar alterações',
      }),
    );

    await waitFor(() => {
      expect(updateOferta).toHaveBeenCalledWith(
        'of-1',
        expect.objectContaining({ vagas_totais: 4 }),
      );
    });
  });

  it('confirm com contagem quando propostas incompatíveis no contexto', async () => {
    render(
      <OfertaEditPanel
        oferta={ofertaFixa}
        onCancel={() => {}}
        onSaved={() => {}}
        propostas={[{ id: 'p1', estado: 'aberta', procura_id: 'pr-1', n_passageiros_propostos: 1 }]}
        procurasById={{
          'pr-1': {
            id: 'pr-1',
            preferred_time: '07:00',
            origin_lat: -8.9,
            origin_lng: 13.2,
            destination_lat: -8.8,
            destination_lng: 13.23,
            dias_semana: [1, 2, 3, 4, 5],
            n_candidato: 1,
          },
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Hora de ida/i), {
      target: { name: 'departure_time', value: '09:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar alterações/i }));

    expect(await screen.findByText(/1 proposta deixa de corresponder/i)).toBeInTheDocument();
    expect(screen.getByText(/1 proposta aberta deixa de corresponder e será invalidada/i)).toBeInTheDocument();
  });
});
