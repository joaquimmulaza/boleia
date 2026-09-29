/**
 * PACOTE ENG #29 — Anti-duplicado após Enviar/Propor (idempotência).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import { createProposta, listOpenPropostasByCreator } from '../services/PropostaService';
import { listOfertasDisponiveis } from '../services/OfertaService';
import { listProcurasByOwner, createProcura } from '../services/ProcuraService';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-pax' }, tipoPerfil: 'Passageiro' }),
}));

vi.mock('../services/PropostaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createProposta: vi.fn(),
    listPropostasByProcura: vi.fn().mockResolvedValue([]),
    listOpenPropostasByCreator: vi.fn().mockResolvedValue([]),
    enrichPropostasForReview: vi.fn().mockResolvedValue([]),
    rejectProposta: vi.fn(),
    cancelProposta: vi.fn(),
  };
});

vi.mock('../services/ProcuraService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listProcurasByOwner: vi.fn(),
    createProcura: vi.fn(),
    updateProcura: vi.fn(),
    cancelProcura: vi.fn(),
  };
});

vi.mock('../services/OfertaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listOfertasDisponiveis: vi.fn(),
    listOfertasByDriver: vi.fn(),
  };
});

vi.mock('../services/MatchingService', () => ({
  findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
  findCompatibleProcuras: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
  toProcuraMatchInput: vi.fn((p) => p),
}));

vi.mock('../services/GrupoService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGrupoByProcura: vi.fn().mockResolvedValue(null),
    listMembrosGrupo: vi.fn().mockResolvedValue([]),
    listGruposAbertos: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/WaitlistService', () => ({
  enqueueWaitlist: vi.fn(),
  listWaitlistByProcura: vi.fn().mockResolvedValue([]),
  filterWaitlistEntriesVisiveis: vi.fn(() => []),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
}));

const OFERTA_BROWSE = {
  id: 'of-browse',
  origin_name: 'Talatona',
  destination_name: 'Maianga',
  departure_time: '07:30',
  vagas_disponiveis: 3,
  valor_mensal_ask_kz: 45000,
  modo_preco: 'POR_PASSAGEIRO',
  flexibilidade_rota: false,
  origin_lat: -8.9,
  origin_lng: 13.2,
  destination_lat: -8.83,
  destination_lng: 13.23,
};

describe('PACOTE ENG #29 — anti-duplicado propostas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProcurasByOwner.mockResolvedValue([]);
    listOfertasDisponiveis.mockResolvedValue([OFERTA_BROWSE]);
    listOpenPropostasByCreator.mockResolvedValue([]);
    createProcura.mockResolvedValue({ id: 'pr-new', estado: 'activa' });
    createProposta.mockResolvedValue({ id: 'prop-1', oferta_id: 'of-browse', estado: 'aberta' });
  });

  it('ENG29-1: browse — 2º tap não chama createProposta de novo (CTA desactivado)', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    const btn = await screen.findByRole('button', { name: /Propor acordo/i });
    fireEvent.click(btn);
    await waitFor(() => expect(createProposta).toHaveBeenCalledTimes(1));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Proposta enviada/i })).toBeDisabled();
    });
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Proposta enviada/i }));
    expect(createProposta).toHaveBeenCalledTimes(1);
  });

  it('ENG29-2: browse — oferta com proposta aberta pré-existente mostra «Proposta enviada»', async () => {
    listOpenPropostasByCreator.mockResolvedValue([
      { id: 'prop-old', oferta_id: 'of-browse', procura_id: 'pr-old', estado: 'aberta' },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Proposta enviada/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();
    expect(createProposta).not.toHaveBeenCalled();
  });
});
