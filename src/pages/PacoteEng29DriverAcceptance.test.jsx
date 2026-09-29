/**
 * PACOTE ENG #29 — Motorista: anti-duplicado hub procuras.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';
import { createProposta, listPropostasByOferta } from '../services/PropostaService';
import { listOfertasByDriver } from '../services/OfertaService';
import { listProcurasDisponiveis } from '../services/ProcuraService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { supabase } from '../lib/supabase';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../services/PropostaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createProposta: vi.fn(),
    listPropostasByOferta: vi.fn().mockResolvedValue([]),
    enrichPropostasForReview: vi.fn().mockResolvedValue([]),
    rejectProposta: vi.fn(),
    cancelProposta: vi.fn(),
  };
});

vi.mock('../services/OfertaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listOfertasByDriver: vi.fn(),
  };
});

vi.mock('../services/ProcuraService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listProcurasDisponiveis: vi.fn(),
  };
});

vi.mock('../services/MatchingService', () => ({
  findCompatibleProcuras: vi.fn(),
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
    from: vi.fn(),
  },
}));

describe('PACOTE ENG #29 — motorista procuras hub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    });
    listOfertasByDriver.mockResolvedValue([
      {
        id: 'of-1',
        estado: 'disponivel',
        origin_name: 'A',
        destination_name: 'B',
        departure_time: '07:00',
        valor_mensal_ask_kz: 40000,
        modo_preco: 'POR_PASSAGEIRO',
        vagas_disponiveis: 3,
      },
    ]);
    listProcurasDisponiveis.mockResolvedValue([
      {
        id: 'pr-1',
        origin_name: 'X',
        destination_name: 'Y',
        preferred_time: '07:00',
        n_candidato: 1,
        owner_id: 'user-pax',
      },
    ]);
    findCompatibleProcuras.mockResolvedValue({
      direct: [
        {
          id: 'pr-1',
          origin_name: 'X',
          destination_name: 'Y',
          preferred_time: '07:00',
          n_candidato: 1,
        },
      ],
      waitlist: [],
      incompatible: [],
    });
    listPropostasByOferta.mockResolvedValue([]);
    createProposta.mockResolvedValue({ id: 'prop-b', procura_id: 'pr-1', estado: 'aberta' });
  });

  it('ENG29-3: motorista — 2º tap «Enviar proposta» não duplica', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: /Procuras e grupos/i }));
    const enviar = await screen.findByRole('button', { name: /Enviar proposta/i });
    fireEvent.click(enviar);
    await waitFor(() => expect(createProposta).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Proposta enviada/i })).toBeDisabled();
    });
    fireEvent.click(screen.getByRole('button', { name: /Proposta enviada/i }));
    expect(createProposta).toHaveBeenCalledTimes(1);
  });

  it('ENG29-4: proposta aberta pré-existente mostra «Proposta enviada»', async () => {
    listPropostasByOferta.mockResolvedValue([
      {
        id: 'prop-old',
        procura_id: 'pr-1',
        oferta_id: 'of-1',
        estado: 'aberta',
        created_by: 'driver-1',
      },
    ]);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: /Procuras e grupos/i }));
    expect(await screen.findByRole('button', { name: /Proposta enviada/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Enviar proposta/i })).not.toBeInTheDocument();
    expect(createProposta).not.toHaveBeenCalled();
  });
});
