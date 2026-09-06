import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import { createProcura, createProcuraWithGrupo, listProcurasByOwner } from '../services/ProcuraService';
import { findCompatibleOfertas } from '../services/MatchingService';
import { createProposta, listPropostasByProcura, enrichPropostasForReview, cancelProposta } from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
import { getGrupoByProcura, listMembrosGrupo } from '../services/GrupoService';
import { listWaitlistByProcura } from '../services/WaitlistService';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro' }),
}));

vi.mock('../services/ProcuraService', () => ({
  createProcura: vi.fn(),
  createProcuraWithGrupo: vi.fn(),
  listProcurasByOwner: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/MatchingService', () => ({
  findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
}));

vi.mock('../services/PropostaService', () => ({
  createProposta: vi.fn(),
  listPropostasByProcura: vi.fn().mockResolvedValue([]),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  cancelProposta: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
}));

vi.mock('../services/WaitlistService', () => ({
  enqueueWaitlist: vi.fn(),
  listWaitlistByProcura: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/GrupoService', () => ({
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
  listMembrosGrupo: vi.fn().mockResolvedValue([]),
  listGruposAbertos: vi.fn().mockResolvedValue([]),
  listPedidosPendentes: vi.fn().mockResolvedValue([]),
  pedirEntradaGrupo: vi.fn(),
  aprovarEntrada: vi.fn(),
  rejeitarEntrada: vi.fn(),
}));

vi.mock('../services/ProfileService', () => ({
  findPassageiroByTelefone: vi.fn(),
}));

vi.mock('../components/AddressInput', () => ({
  default: ({ name, label, value, onChange, onSelectCoordinates }) => (
    <label>
      {label}
      <input
        name={name}
        aria-label={label}
        value={value || ''}
        onChange={(e) => {
          onChange?.(e);
          onSelectCoordinates?.({ lat: -8.9, lng: 13.1 });
        }}
      />
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
    localStorage.clear();
    listProcurasByOwner.mockResolvedValue([]);
    getGrupoByProcura.mockResolvedValue(null);
    listMembrosGrupo.mockResolvedValue([]);
    listWaitlistByProcura.mockResolvedValue([]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
    listPropostasByProcura.mockResolvedValue([]);
    enrichPropostasForReview.mockResolvedValue([]);
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

  it('empty de matches fala em horário e trajeto — sem «zona»', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase }]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(/Ainda não há ofertas compatíveis com o teu horário e trajeto/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/zona/i)).not.toBeInTheDocument();
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
    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(/Proposta enviada/i);
    expect(screen.getByTestId('passenger-feedback')).toHaveAttribute('data-variant', 'success');
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

  it('mostra Grupo · X de Y e chip Activa na procura com grupo', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 2, estado: 'activa' }]);
    getGrupoByProcura.mockResolvedValue({
      id: 'g-1',
      procura_id: 'pr-1',
      nome: 'Colegas',
      n_maximo: 4,
    });
    listMembrosGrupo.mockResolvedValue([
      { id: 'm-1', passenger_id: 'pax-1', estado: 'activo', ordem_insercao: 0, perfis: { nome_completo: 'Ana' } },
      { id: 'm-2', passenger_id: 'pax-2', estado: 'activo', ordem_insercao: 1, perfis: { nome_completo: 'Bruno' } },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Grupo · 2 de 4')).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
    expect(screen.queryByText(/N_actual/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/n_candidato/i)).not.toBeInTheDocument();
  });

  it('cards de oferta directa usam «lugares disponíveis» e modo humano', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [{ ...ofertaDirect, modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 40000, vagas_disponiveis: 2 }],
      waitlist: [],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('2 lugares disponíveis')).toBeInTheDocument();
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
    expect(screen.getByText('Disponível')).toBeInTheDocument();
    expect(screen.queryByText('POR_PASSAGEIRO')).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ lugares$/)).not.toBeInTheDocument();
  });

  it('waitlist mostra o mesmo bloco de preço/modo que a oferta directa', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [],
      waitlist: [
        {
          id: 'of-w',
          origin_name: 'Kilamba',
          destination_name: 'Maianga',
          departure_time: '07:00:00',
          vagas_disponiveis: 0,
          valor_mensal_ask_kz: 80000,
          modo_preco: 'POR_PASSAGEIRO',
        },
      ],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Lista de espera')).toBeInTheDocument();
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
    expect(screen.getByText(/80[\s.]?000/)).toBeInTheDocument();
    expect(screen.getAllByText('0 lugares disponíveis').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('POR_PASSAGEIRO')).not.toBeInTheDocument();
  });

  it('mostra propostas enviadas e permite cancelar pelo criador', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-out',
        estado: 'aberta',
        created_by: 'pax-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 100000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 100000 }],
        pricing: {
          valor_mensal_total_kz: 100000,
          valor_mensal_por_passageiro_kz: 100000,
          quotas: [100000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    cancelProposta.mockImplementation(async (id) => {
      listPropostasByProcura.mockResolvedValue([]);
      return { id, estado: 'cancelada' };
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Propostas enviadas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar proposta/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aceitar proposta/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cancelamento/i }));

    await waitFor(() => {
      expect(cancelProposta).toHaveBeenCalledWith('prop-out');
    });
    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(/Proposta cancelada/i);
    expect(screen.getByTestId('passenger-feedback')).toHaveAttribute('role', 'status');
  });

  it('criar procura envia dias_semana e teto_mensal_kz ao interagir no formulário', async () => {
    createProcura.mockResolvedValue({
      ...procuraBase,
      id: 'pr-nova',
      dias_semana: [1, 2, 3, 4, 5, 6],
      teto_mensal_kz: 50000,
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Criar procura/i }));

    fireEvent.change(screen.getByLabelText(/^Origem$/i), {
      target: { name: 'origin_name', value: 'Talatona' },
    });
    fireEvent.change(screen.getByLabelText(/^Destino$/i), {
      target: { name: 'destination_name', value: 'Miramar' },
    });

    const sab = screen.getByRole('button', { name: /^Sáb$/i });
    expect(sab).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(sab);
    expect(sab).toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByLabelText(/Teto mensal por passageiro/i), {
      target: { name: 'teto_mensal_kz', value: '50000' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar procura/i }));

    await waitFor(() => {
      expect(createProcura).toHaveBeenCalledWith(
        expect.objectContaining({
          dias_semana: [1, 2, 3, 4, 5, 6],
          teto_mensal_kz: 50000,
          origin_name: 'Talatona',
          destination_name: 'Miramar',
        }),
      );
    });
  });

  it('mostra teto mensal formatado no hub quando a procura tem teto_mensal_kz', async () => {
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, teto_mensal_kz: 50000 },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/50[\s.]?000\s*Kz/i)).toBeInTheDocument();
    expect(screen.getByText(/Teto por passageiro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver ofertas compatíveis/i })).toBeInTheDocument();
  });

  it('criar procura em modo grupo chama createProcuraWithGrupo (atómico)', async () => {
    createProcuraWithGrupo.mockResolvedValue({
      ...procuraBase,
      id: 'pr-grupo',
      n_candidato: 1,
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Criar procura/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Grupo$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^5$/i }));

    fireEvent.change(screen.getByLabelText(/^Origem$/i), {
      target: { name: 'origin_name', value: 'Talatona' },
    });
    fireEvent.change(screen.getByLabelText(/^Destino$/i), {
      target: { name: 'destination_name', value: 'Miramar' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar procura/i }));

    await waitFor(() => {
      expect(createProcuraWithGrupo).toHaveBeenCalledWith(
        expect.objectContaining({
          origin_name: 'Talatona',
          destination_name: 'Miramar',
        }),
        expect.objectContaining({
          nome: 'O meu grupo',
          nMaximo: 5,
          pickup_name: 'Talatona',
          dropoff_name: 'Miramar',
        }),
      );
    });
    expect(createProcura).not.toHaveBeenCalled();
  });

  it('modo grupo: falha atómica não chama createProcura separado', async () => {
    createProcuraWithGrupo.mockRejectedValue(new Error('Falha ao criar grupo.'));

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Criar procura/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Grupo$/i }));

    fireEvent.change(screen.getByLabelText(/^Origem$/i), {
      target: { name: 'origin_name', value: 'Talatona' },
    });
    fireEvent.change(screen.getByLabelText(/^Destino$/i), {
      target: { name: 'destination_name', value: 'Miramar' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Guardar procura/i }));

    await waitFor(() => {
      expect(createProcuraWithGrupo).toHaveBeenCalled();
    });
    expect(createProcura).not.toHaveBeenCalled();
    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(/Falha ao criar grupo/i);
  });

  it('persiste modo teto total do acordo após reload simulado', async () => {
    localStorage.setItem('procuraTetoModo:v1', 'TOTAL_ACORDO');
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, teto_mensal_kz: 80000 },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Teto total do acordo/i)).toBeInTheDocument();
  });

  it('mostra inbox de propostas do motorista e permite aceitar (sentido B)', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-b',
        estado: 'aberta',
        created_by: 'driver-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [
          {
            passenger_id: 'pax-1',
            nome: 'Tu',
            quota_mensal_kz: 120000,
          },
        ],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    createAgreementFromProposal.mockResolvedValue({ id: 'ac-b' });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Propostas recebidas')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Aceitar proposta/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-b');
    });
  });
});
