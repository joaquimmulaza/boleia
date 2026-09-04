import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';
import {
  listPropostasByOferta,
  enrichPropostasForReview,
} from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../services/OfertaService', () => ({
  listOfertasByDriver: vi.fn().mockResolvedValue([
    {
      id: 'of-1',
      origin_name: 'Talatona',
      destination_name: 'Mutual',
      departure_time: '07:15',
      vagas_disponiveis: 3,
      modo_preco: 'TOTAL_ACORDO',
      valor_mensal_ask_kz: 120000,
      estado: 'parcial',
    },
  ]),
}));

vi.mock('../services/PropostaService', () => ({
  listPropostasByOferta: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
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

const propostaAberta = {
  id: 'prop-1',
  oferta_id: 'of-1',
  estado: 'aberta',
  modo_preco: 'TOTAL_ACORDO',
  valor_mensal_ask_kz: 120000,
  n_passageiros_propostos: 3,
  grupo_id: 'g-1',
};

const reviewFixture = {
  proposta: propostaAberta,
  membros: [
    {
      passenger_id: 'p1',
      nome: 'Ana Silva',
      telefone: '+244900000001',
      pickup_name: 'Talatona',
      quota_mensal_kz: 40000,
      ordem_insercao: 0,
    },
    {
      passenger_id: 'p2',
      nome: 'Bruno Costa',
      telefone: '+244900000002',
      pickup_name: null,
      quota_mensal_kz: 40000,
      ordem_insercao: 1,
    },
    {
      passenger_id: 'p3',
      nome: 'Carla Dias',
      telefone: '+244900000003',
      pickup_name: 'Miramar',
      quota_mensal_kz: 40000,
      ordem_insercao: 2,
    },
  ],
  pricing: {
    valor_mensal_total_kz: 120000,
    valor_mensal_por_passageiro_kz: 40000,
    quotas: [40000, 40000, 40000],
    temResto: false,
  },
  titulo: 'Grupo · 3 pessoas',
  avisoComposicao: null,
};

describe('DriverDashboard — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPropostasByOferta.mockResolvedValue([]);
    enrichPropostasForReview.mockResolvedValue([]);
  });

  it('mostra ofertas do motorista com copy humana', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('As minhas ofertas')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Talatona')).toBeInTheDocument();
      expect(screen.getByText('Mutual')).toBeInTheDocument();
      expect(screen.getByText(/3 lugares disponíveis/i)).toBeInTheDocument();
      expect(screen.getByText(/Total do acordo/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Publicar oferta/i })).toBeInTheDocument();
  });

  it('ao Ver propostas mostra título enriquecido e Aceitar', async () => {
    listPropostasByOferta.mockResolvedValue([propostaAberta]);
    enrichPropostasForReview.mockResolvedValue([reviewFixture]);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Ver propostas/i }));

    expect(await screen.findByText('Grupo · 3 pessoas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Aceitar proposta/i })).toBeInTheDocument();
    expect(enrichPropostasForReview).toHaveBeenCalledWith([propostaAberta]);
  });

  it('ao mudar de oferta limpa reviews anteriores e não mostra empty falso durante o carregamento', async () => {
    listPropostasByOferta.mockResolvedValue([propostaAberta]);
    let resolveEnrich;
    const enrichPromise = new Promise((resolve) => {
      resolveEnrich = resolve;
    });
    enrichPropostasForReview.mockReturnValue(enrichPromise);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Ver propostas/i }));

    await waitFor(() => {
      expect(enrichPropostasForReview).toHaveBeenCalled();
    });
    expect(screen.queryByText(/Não há propostas abertas nesta oferta/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Grupo · 3 pessoas')).not.toBeInTheDocument();

    resolveEnrich([reviewFixture]);
    expect(await screen.findByText('Grupo · 3 pessoas')).toBeInTheDocument();
  });

  it('Aceitar confirma e chama createAgreementFromProposal', async () => {
    listPropostasByOferta.mockResolvedValue([propostaAberta]);
    enrichPropostasForReview.mockResolvedValue([reviewFixture]);
    createAgreementFromProposal.mockResolvedValue({ id: 'ac-1' });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Ver propostas/i }));
    await screen.findByText('Grupo · 3 pessoas');

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-1');
    });
    expect(await screen.findByText(/Proposta aceite\. Acordo criado/i)).toBeInTheDocument();
  });
});
