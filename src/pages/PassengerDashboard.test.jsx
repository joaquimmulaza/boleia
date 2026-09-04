import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import { listProcurasByOwner } from '../services/ProcuraService';
import { findCompatibleOfertas } from '../services/MatchingService';
import { createProposta } from '../services/PropostaService';
import { getGrupoByProcura, listMembrosGrupo } from '../services/GrupoService';
import { listWaitlistByProcura } from '../services/WaitlistService';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro' }),
}));

vi.mock('../services/ProcuraService', () => ({
  createProcura: vi.fn(),
  listProcurasByOwner: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/MatchingService', () => ({
  findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
}));

vi.mock('../services/PropostaService', () => ({
  createProposta: vi.fn(),
}));

vi.mock('../services/WaitlistService', () => ({
  enqueueWaitlist: vi.fn(),
  listWaitlistByProcura: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/GrupoService', () => ({
  createGrupo: vi.fn(),
  addMembroGrupo: vi.fn(),
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
  listMembrosGrupo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/ProfileService', () => ({
  findPassageiroByTelefone: vi.fn(),
}));

vi.mock('../components/AddressInput', () => ({
  default: ({ name, label }) => (
    <label>
      {label}
      <input name={name} />
    </label>
  ),
}));

const procuraBase = {
  id: 'pr-1',
  estado: 'activa',
  origin_name: 'Talatona',
  destination_name: 'Miramar',
  preferred_time: '07:15:00',
  origin_lat: -8.9,
  origin_lng: 13.1,
  destination_lat: -8.8,
  destination_lng: 13.2,
};

const ofertaDirect = {
  id: 'of-1',
  origin_name: 'Talatona',
  destination_name: 'Miramar',
  departure_time: '07:15:00',
  vagas_disponiveis: 4,
  valor_mensal_ask_kz: 100000,
  modo_preco: 'TOTAL_ACORDO',
};

describe('PassengerDashboard — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listProcurasByOwner.mockResolvedValue([]);
    getGrupoByProcura.mockResolvedValue(null);
    listMembrosGrupo.mockResolvedValue([]);
    listWaitlistByProcura.mockResolvedValue([]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
  });

  it('mostra empty state para criar procura', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('A minha procura')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Sem procura activa/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Criar procura/i })).toBeInTheDocument();
    });
  });

  it('com procura activa mostra painel para criar grupo', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /Criar grupo/i })).toBeInTheDocument();
    expect(screen.getByText(/Grupo de viagem/i)).toBeInTheDocument();
  });

  it('grupo vivo: propõe com N_actual mesmo abaixo da capacidade pretendida', async () => {
    // n_candidato / n_maximo conceptual = 4, mas só 2 membros → N_proposto = 2
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 2 }]);
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: 'Colegas' });
    listMembrosGrupo.mockResolvedValue([
      { id: 'm-1', passenger_id: 'pax-1', estado: 'activo', ordem_insercao: 0, perfis: { nome_completo: 'Ana' } },
      { id: 'm-2', passenger_id: 'pax-2', estado: 'activo', ordem_insercao: 1, perfis: { nome_completo: 'Bruno' } },
    ]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [ofertaDirect],
      waitlist: [],
      incompatible: [],
    });
    createProposta.mockResolvedValue({ id: 'prop-1', grupo_id: 'g-1', n_passageiros_propostos: 2 });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          grupo_id: 'g-1',
          n_passageiros_propostos: 2,
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 100000,
        }),
      );
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/Proposta enviada/i);
  });

  it('ao propor com grupo de 3 envia grupo_id e N_actual = 3', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 3 }]);
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: 'Colegas' });
    listMembrosGrupo.mockResolvedValue([
      { id: 'm-1', passenger_id: 'pax-1', estado: 'activo', ordem_insercao: 0, perfis: { nome_completo: 'Ana' } },
      { id: 'm-2', passenger_id: 'pax-2', estado: 'activo', ordem_insercao: 1, perfis: { nome_completo: 'Bruno' } },
      { id: 'm-3', passenger_id: 'pax-3', estado: 'activo', ordem_insercao: 2, perfis: { nome_completo: 'Carla' } },
    ]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [ofertaDirect],
      waitlist: [],
      incompatible: [],
    });
    createProposta.mockResolvedValue({ id: 'prop-1', grupo_id: 'g-1', n_passageiros_propostos: 3 });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          grupo_id: 'g-1',
          n_passageiros_propostos: 3,
        }),
      );
    });
  });

  it('bloqueia N>1 sem entidade grupo (não por «incompleto»)', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 3 }]);
    getGrupoByProcura.mockResolvedValue(null);
    findCompatibleOfertas.mockResolvedValue({
      direct: [ofertaDirect],
      waitlist: [],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/grupo/i);
    expect(createProposta).not.toHaveBeenCalled();
  });

  it('mostra estado na lista de espera (activa e notificada)', async () => {
    const ofertaWait = {
      id: 'of-w',
      origin_name: 'Kilamba',
      destination_name: 'Maianga',
      departure_time: '07:00:00',
      vagas_disponiveis: 0,
      valor_mensal_ask_kz: 80000,
      modo_preco: 'POR_PASSAGEIRO',
    };
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [],
      waitlist: [ofertaWait],
      incompatible: [],
    });
    listWaitlistByProcura.mockResolvedValue([
      { id: 'w-1', oferta_id: 'of-w', procura_id: 'pr-1', estado: 'notificada' },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Abriu-se uma vaga numa oferta em que estás em espera/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Há uma vaga — podes propor acordo/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Propor acordo/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Entrar na lista de espera/i })).not.toBeInTheDocument();
  });
});
