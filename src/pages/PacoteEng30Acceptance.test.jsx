/**
 * PACOTE ENG #30 — Counter-ask: valor mensal editável ao propor.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import DriverDashboard from './DriverDashboard';
import { createProposta } from '../services/PropostaService';
import { listOfertasDisponiveis } from '../services/OfertaService';
import { listProcurasByOwner, createProcura } from '../services/ProcuraService';
import { listOfertasByDriver } from '../services/OfertaService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { getAgreementsForDriver } from '../services/AgreementService';
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
    listOpenPropostasByCreator: vi.fn().mockResolvedValue([]),
    enrichPropostasForReview: vi.fn().mockResolvedValue([]),
    rejectProposta: vi.fn(),
    cancelProposta: vi.fn(),
    listPropostasByOferta: vi.fn().mockResolvedValue([]),
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
    listProcurasDisponiveis: vi.fn().mockResolvedValue([]),
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

describe('PACOTE ENG #30 — counter-ask preço na proposta', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { useAuth } = await import('../contexts/AuthContext');
    useAuth.mockReturnValue({ user: { id: 'user-pax' }, tipoPerfil: 'Passageiro' });
    listProcurasByOwner.mockResolvedValue([]);
    listOfertasDisponiveis.mockResolvedValue([OFERTA_BROWSE]);
    createProcura.mockResolvedValue({ id: 'pr-new', n_candidato: 1, estado: 'activa' });
    createProposta.mockResolvedValue({ id: 'prop-1', oferta_id: 'of-browse', estado: 'aberta' });
  });

  it('ENG30-1: browse pré-preenche ask e envia valor editado (counter-ask)', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

    const valorInput = await screen.findByLabelText(/valor.*proposta/i);
    expect(valorInput).toHaveValue(45000);

    fireEvent.change(valorInput, { target: { value: '38000' } });
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-browse',
          valor_mensal_ask_kz: 38000,
        }),
      );
    });
  });

  it('ENG30-2: browse 1 tap com ask default mantém comportamento antigo', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          valor_mensal_ask_kz: 45000,
        }),
      );
    });
  });

  it('ENG30-1b: abrir o sheet browse não cria proposta antes do envio', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));
    await screen.findByLabelText(/valor.*proposta/i);

    expect(createProcura).not.toHaveBeenCalled();
    expect(createProposta).not.toHaveBeenCalled();
  });

  it('ENG30-1c: oferta lotada desactiva o CTA e não abre sheet editável', async () => {
    listOfertasDisponiveis.mockResolvedValue([{ ...OFERTA_BROWSE, vagas_disponiveis: 0 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    const card = await screen.findByTestId('opportunity-card');
    expect(within(card).getByText('Talatona')).toBeInTheDocument();
    expect(within(card).getByText('Maianga')).toBeInTheDocument();
    expect(within(card).getByText('Sem lugares disponíveis')).toBeInTheDocument();

    const cta = within(card).getByRole('button', { name: /Propor acordo/i });
    expect(cta).toBeDisabled();

    fireEvent.click(cta);
    expect(screen.queryByTestId('opportunity-proposal-sheet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('proposta-valor-input')).not.toBeInTheDocument();
    expect(createProcura).not.toHaveBeenCalled();
    expect(createProposta).not.toHaveBeenCalled();
  });

  it('ENG30-3: motorista envia o preço da oferta no sheet, sem o editar', async () => {
    const { useAuth } = await import('../contexts/AuthContext');
    useAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });

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
    const { listProcurasDisponiveis } = await import('../services/ProcuraService');
    listProcurasDisponiveis.mockResolvedValue([
      {
        id: 'pr-1',
        origin_name: 'Kilamba',
        destination_name: 'Baixa',
        preferred_time: '07:10:00',
        n_candidato: 1,
      },
    ]);
    getAgreementsForDriver.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Enviar proposta/i }));

    const sheet = await screen.findByTestId('opportunity-proposal-sheet');
    expect(within(sheet).getByText('Este número fica fixo nesta proposta.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Mais passageiros' })).not.toBeInTheDocument();
    expect(within(sheet).queryByLabelText(/valor.*proposta/i)).not.toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Enviar proposta' }));

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          valor_mensal_ask_kz: 120000,
          modo_preco: 'TOTAL_ACORDO',
          n_passageiros_propostos: 1,
        }),
      );
    });
  });
});
