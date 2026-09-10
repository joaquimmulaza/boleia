/**
 * PACOTE ENG #26 — Hub motorista: tab «Procuras e grupos» sempre visível + CTA «Enviar proposta».
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';
import { listOfertasByDriver } from '../services/OfertaService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { createProposta } from '../services/PropostaService';
import { getAgreementsForDriver } from '../services/AgreementService';
import { supabase } from '../lib/supabase';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../services/OfertaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listOfertasByDriver: vi.fn(),
  };
});

vi.mock('../services/PropostaService', () => ({
  listPropostasByOferta: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  cancelProposta: vi.fn(),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
  createProposta: vi.fn(),
}));

vi.mock('../services/MatchingService', () => ({
  findCompatibleProcuras: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
}));

vi.mock('../services/GrupoService', () => ({
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
  getAgreementsForDriver: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    })),
  },
}));

describe('PACOTE ENG #26 — hub motorista procuras e grupos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    });
    listOfertasByDriver.mockResolvedValue([]);
    getAgreementsForDriver.mockResolvedValue([]);
    findCompatibleProcuras.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
    createProposta.mockResolvedValue({ id: 'prop-b' });
  });

  it('hub vazio (zero ofertas) mostra tab e secção com empty state', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('driver-hub-tabs')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    expect(await screen.findByTestId('driver-procuras-grupos-section')).toBeInTheDocument();
    expect(screen.getByTestId('driver-procuras-empty-sem-oferta')).toBeInTheDocument();
    expect(screen.getByText(/Precisas de uma oferta activa/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar proposta/i })).not.toBeInTheDocument();
    expect(findCompatibleProcuras).not.toHaveBeenCalled();
  });

  it('feed procuras usa CTA «Enviar proposta» (não «Propor acordo»)', async () => {
    listOfertasByDriver.mockResolvedValue([
      {
        id: 'of-1',
        origin_name: 'Talatona',
        destination_name: 'Mutual',
        departure_time: '07:15',
        vagas_disponiveis: 3,
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        estado: 'parcial',
        flexibilidade_rota: false,
      },
    ]);
    findCompatibleProcuras.mockResolvedValue({
      direct: [
        {
          id: 'pr-1',
          origin_name: 'Kilamba',
          destination_name: 'Baixa',
          preferred_time: '07:10:00',
          n_candidato: 1,
        },
      ],
      waitlist: [],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    expect(await screen.findByRole('button', { name: /Enviar proposta/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enviar proposta/i }));

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          n_passageiros_propostos: 1,
        }),
      );
    });
  });

  it('oferta flexível: secção procuras sem OD inventada na oferta', async () => {
    listOfertasByDriver.mockResolvedValue([
      {
        id: 'of-flex',
        origin_name: null,
        destination_name: null,
        departure_time: '07:30',
        vagas_disponiveis: 2,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        estado: 'disponivel',
        flexibilidade_rota: true,
      },
    ]);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Oferta flexível');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    const section = await screen.findByTestId('driver-procuras-grupos-section');
    expect(within(section).getByText(/sem exigir origem\/destino na tua oferta/i)).toBeInTheDocument();
    expect(within(section).queryByText('Origem')).not.toBeInTheDocument();
    expect(within(section).queryByText('Destino')).not.toBeInTheDocument();
  });
});
