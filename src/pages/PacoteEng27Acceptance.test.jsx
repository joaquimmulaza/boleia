/**
 * PACOTE ENG #27 — Hub motorista: todas procuras/grupos + toggle + dedupe Oferta flexível.
 */
import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';
import { listOfertasByDriver } from '../services/OfertaService';
import { listProcurasDisponiveis } from '../services/ProcuraService';
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

vi.mock('../services/ProcuraService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listProcurasDisponiveis: vi.fn(),
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

const ofertaFixa = {
  id: 'of-1',
  origin_name: 'Talatona',
  destination_name: 'Mutual',
  departure_time: '07:15',
  vagas_disponiveis: 3,
  modo_preco: 'TOTAL_ACORDO',
  valor_mensal_ask_kz: 120000,
  estado: 'parcial',
  flexibilidade_rota: false,
};

const procuraCompativel = {
  id: 'pr-match',
  origin_name: 'Kilamba',
  destination_name: 'Baixa',
  preferred_time: '07:10:00',
  n_candidato: 1,
  estado: 'activa',
};

const procuraOutra = {
  id: 'pr-outra',
  origin_name: 'Viana',
  destination_name: 'Miramar',
  preferred_time: '18:00:00',
  n_candidato: 1,
  estado: 'activa',
};

describe('PACOTE ENG #27 — hub motorista todas procuras + toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    });
    listOfertasByDriver.mockResolvedValue([{ ...ofertaFixa }]);
    getAgreementsForDriver.mockResolvedValue([]);
    listProcurasDisponiveis.mockResolvedValue([procuraCompativel, procuraOutra]);
    findCompatibleProcuras.mockResolvedValue({
      direct: [procuraCompativel],
      waitlist: [],
      incompatible: [procuraOutra],
    });
    createProposta.mockResolvedValue({ id: 'prop-b' });
  });

  it('ENG27-1: tab lista todas as procuras por defeito (toggle OFF)', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    expect(await screen.findByText('Kilamba')).toBeInTheDocument();
    expect(screen.getByText('Viana')).toBeInTheDocument();
    expect(listProcurasDisponiveis).toHaveBeenCalled();

    const toggle = screen.getByTestId('driver-procuras-só-compatíveis');
    expect(toggle).not.toBeChecked();
  });

  it('ENG27-2: toggle «Só compatíveis» filtra feed e empty state dedicado', async () => {
    listProcurasDisponiveis.mockResolvedValue([procuraCompativel]);
    findCompatibleProcuras.mockResolvedValue({
      direct: [],
      waitlist: [],
      incompatible: [procuraCompativel],
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));
    expect(await screen.findByText('Kilamba')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('driver-procuras-só-compatíveis'));

    expect(await screen.findByTestId('driver-procuras-empty-filtrado')).toBeInTheDocument();
    expect(screen.queryByText('Kilamba')).not.toBeInTheDocument();
  });

  it('ENG27-3: card oferta mantém atalho «Procuras compatíveis» (activa filtro)', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Procuras compatíveis/i }));

    expect(await screen.findByTestId('driver-procuras-grupos-section')).toBeInTheDocument();
    expect(screen.getByTestId('driver-procuras-só-compatíveis')).toBeChecked();
    expect(screen.queryByText('Viana')).not.toBeInTheDocument();
    expect(screen.getByText('Kilamba')).toBeInTheDocument();
  });

  it('ENG27-4: picker dedupe «Oferta flexível» com horário distinto', async () => {
    listOfertasByDriver.mockResolvedValue([
      {
        id: 'of-flex-am',
        origin_name: null,
        destination_name: null,
        departure_time: '07:30',
        vagas_disponiveis: 2,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        estado: 'disponivel',
        flexibilidade_rota: true,
      },
      {
        id: 'of-flex-pm',
        origin_name: null,
        destination_name: null,
        departure_time: '17:30',
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

    await screen.findByTestId('driver-hub-tabs');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    const picker = await screen.findByTestId('driver-procuras-oferta-picker');
    const buttons = within(picker).getAllByRole('button');
    const labels = buttons.map((btn) => btn.textContent);
    expect(labels.filter((l) => l === 'Oferta flexível')).toHaveLength(0);
    expect(labels.some((l) => /07:30/.test(l || ''))).toBe(true);
    expect(labels.some((l) => /17:30/.test(l || ''))).toBe(true);
  });

  it('ENG27-5: empty state marketplace vazio (todas, sem procuras)', async () => {
    listProcurasDisponiveis.mockResolvedValue([]);
    findCompatibleProcuras.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    expect(await screen.findByTestId('driver-procuras-empty-todas')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar proposta/i })).not.toBeInTheDocument();
  });

  it('ENG27-6: CTA «Enviar proposta» só em direct compatível', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('tab', { name: /Procuras e grupos/i }));

    expect(await screen.findByText('Kilamba')).toBeInTheDocument();
    expect(screen.getByText('Viana')).toBeInTheDocument();

    const proporButtons = screen.getAllByRole('button', { name: /Enviar proposta/i });
    expect(proporButtons).toHaveLength(1);

    fireEvent.click(proporButtons[0]);

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-match',
        }),
      );
    });
  });
});
