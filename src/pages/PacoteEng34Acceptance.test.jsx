/**
 * PACOTE ENG #34 — Contra-proposta na proposta recebida (contraparte inbox).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import DriverDashboard from './DriverDashboard';
import { createProposta } from '../services/PropostaService';
import { listProcurasByOwner } from '../services/ProcuraService';
import { listOfertasByDriver } from '../services/OfertaService';
import { findCompatibleOfertas } from '../services/MatchingService';
import { confirmPropostaSheet } from '../test/confirmPropostaSheet';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/PropostaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    createProposta: vi.fn(),
    listPropostasByProcura: vi.fn().mockResolvedValue([]),
    listPropostasByOferta: vi.fn().mockResolvedValue([]),
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
    listProcurasDisponiveis: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/OfertaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listOfertasDisponiveis: vi.fn().mockResolvedValue([]),
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

const procuraBase = {
  id: 'pr-1',
  estado: 'activa',
  origin_name: 'Talatona',
  destination_name: 'Maianga',
  preferred_time: '07:30:00',
  n_candidato: 1,
};

const propostaRecebidaMotorista = {
  id: 'prop-in',
  estado: 'aberta',
  created_by: 'driver-1',
  oferta_id: 'of-1',
  procura_id: 'pr-1',
  modo_preco: 'POR_PASSAGEIRO',
  valor_mensal_ask_kz: 38000,
  n_passageiros_propostos: 1,
  grupo_id: null,
};

function mockEnrichInbox(lista) {
  return (lista || []).map((p) => ({
    proposta: p,
    titulo: 'Individual',
    membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: p.valor_mensal_ask_kz }],
    pricing: {
      valor_mensal_total_kz: p.valor_mensal_ask_kz,
      valor_mensal_por_passageiro_kz: p.valor_mensal_ask_kz,
      quotas: [p.valor_mensal_ask_kz],
      temResto: false,
    },
    avisoComposicao: null,
  }));
}

describe('PACOTE ENG #34 — contra-proposta na proposta recebida', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useAuth } = await import('../contexts/AuthContext');
    useAuth.mockReturnValue({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro' });
    listProcurasByOwner.mockResolvedValue([procuraBase]);
    createProposta.mockResolvedValue({ id: 'prop-counter', estado: 'aberta' });
  });

  it('ENG34-1: passageiro vê CTA contra-proposta e distingue valor proposto vs publicado', async () => {
    const { listPropostasByProcura, enrichPropostasForReview } = await import('../services/PropostaService');
    listPropostasByProcura.mockResolvedValue([propostaRecebidaMotorista]);
    enrichPropostasForReview.mockImplementation(async (lista) => mockEnrichInbox(lista));
    findCompatibleOfertas.mockResolvedValue({
      direct: [
        {
          id: 'of-1',
          valor_mensal_ask_kz: 45000,
          modo_preco: 'POR_PASSAGEIRO',
          departure_time: '07:30',
          vagas_disponiveis: 3,
        },
      ],
      waitlist: [],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'A minha procura' }));
    expect(await screen.findByRole('button', { name: /Fazer contra-proposta/i })).toBeInTheDocument();
    expect(screen.getByText(/Valor proposto:/i)).toBeInTheDocument();
    expect(screen.getByText(/Preço publicado:/i)).toBeInTheDocument();
  });

  it('ENG34-2: passageiro envia contra-proposta com valor editado', async () => {
    const { listPropostasByProcura, enrichPropostasForReview } = await import('../services/PropostaService');
    listPropostasByProcura.mockResolvedValue([propostaRecebidaMotorista]);
    enrichPropostasForReview.mockImplementation(async (lista) => mockEnrichInbox(lista));
    findCompatibleOfertas.mockResolvedValue({
      direct: [{ id: 'of-1', valor_mensal_ask_kz: 45000, modo_preco: 'POR_PASSAGEIRO' }],
      waitlist: [],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'A minha procura' }));
    fireEvent.click(await screen.findByRole('button', { name: /Fazer contra-proposta/i }));

    const sheet = await screen.findByTestId('contra-proposta-sheet');
    const valorInput = await screen.findByTestId('proposta-valor-input');
    expect(valorInput).toHaveValue(38000);
    expect(sheet).toHaveTextContent(/Preço publicado:.*45[\s.]?000/i);

    fireEvent.change(valorInput, { target: { value: '42000' } });
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          valor_mensal_ask_kz: 42000,
        }),
      );
    });
  });

  it('ENG34-4: passageiro com enviada aberta à mesma oferta ainda vê CTA e cancela+cria no submit', async () => {
    const { listPropostasByProcura, enrichPropostasForReview, cancelProposta } = await import('../services/PropostaService');
    const propostaEnviadaPax = {
      id: 'prop-out',
      estado: 'aberta',
      created_by: 'pax-1',
      oferta_id: 'of-1',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 40000,
      n_passageiros_propostos: 1,
      grupo_id: null,
    };
    listPropostasByProcura.mockResolvedValue([propostaRecebidaMotorista, propostaEnviadaPax]);
    enrichPropostasForReview.mockImplementation(async (lista) => mockEnrichInbox(lista));
    cancelProposta.mockResolvedValue({ id: 'prop-out', estado: 'cancelada' });
    findCompatibleOfertas.mockResolvedValue({
      direct: [{ id: 'of-1', valor_mensal_ask_kz: 45000, modo_preco: 'POR_PASSAGEIRO' }],
      waitlist: [],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('tab', { name: 'A minha procura' }));
    expect(await screen.findByRole('button', { name: /Fazer contra-proposta/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fazer contra-proposta/i }));
    fireEvent.change(await screen.findByTestId('proposta-valor-input'), { target: { value: '42000' } });
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(cancelProposta).toHaveBeenCalledWith('prop-out');
    });
    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          valor_mensal_ask_kz: 42000,
        }),
      );
    });
    const { rejectProposta } = await import('../services/PropostaService');
    expect(rejectProposta).not.toHaveBeenCalled();
  });

  it('ENG34-3: motorista contra-proposta a proposta recebida', async () => {
    const { useAuth } = await import('../contexts/AuthContext');
    useAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });

    const { listPropostasByOferta, enrichPropostasForReview } = await import('../services/PropostaService');
    listOfertasByDriver.mockResolvedValue([
      {
        id: 'of-1',
        origin_name: 'Talatona',
        destination_name: 'Maianga',
        departure_time: '07:30',
        vagas_disponiveis: 3,
        valor_mensal_ask_kz: 50000,
        modo_preco: 'POR_PASSAGEIRO',
        estado: 'parcial',
        flexibilidade_rota: false,
      },
    ]);
    listPropostasByOferta.mockResolvedValue([
      {
        id: 'prop-pax',
        estado: 'aberta',
        created_by: 'pax-1',
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 55000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: '1 passageiro',
        membros: [],
        pricing: {
          valor_mensal_total_kz: 55000,
          valor_mensal_por_passageiro_kz: 55000,
          quotas: [55000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );

    render(
      <MemoryRouter initialEntries={['/motorista?focus=propostas&openOfertaId=of-1']}>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByTestId('proposal-sheet');
    fireEvent.click(await screen.findByRole('button', { name: /Ver proposta 1 passageiro/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Fazer contra-proposta/i }));

    const valorInput = await screen.findByTestId('proposta-valor-input');
    fireEvent.change(valorInput, { target: { value: '48000' } });
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          valor_mensal_ask_kz: 48000,
        }),
      );
    });
  });
});
