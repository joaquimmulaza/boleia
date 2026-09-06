import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DriverDashboard from './DriverDashboard';
import {
  listPropostasByOferta,
  enrichPropostasForReview,
  createProposta,
  cancelProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal } from '../services/AgreementService';
import { findCompatibleProcuras } from '../services/MatchingService';
import { getGrupoByProcura } from '../services/GrupoService';
import { listOfertasByDriver } from '../services/OfertaService';
import { supabase } from '../lib/supabase';
import { expectNoUserFacingJargon } from '../test/jargonBan';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
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

vi.mock('../services/OfertaService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
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
        flexibilidade_rota: false,
      },
    ]),
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
  created_by: 'pax-1',
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
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [{ id: 'vei-1' }], error: null }),
      })),
    });
    listOfertasByDriver.mockResolvedValue([{ ...ofertaFixa }]);
    listPropostasByOferta.mockResolvedValue([]);
    enrichPropostasForReview.mockImplementation(async (lista) => (lista?.length ? [] : []));
    findCompatibleProcuras.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
    getGrupoByProcura.mockResolvedValue(null);
    createProposta.mockResolvedValue({ id: 'prop-b' });
    cancelProposta.mockResolvedValue({ id: 'prop-own', estado: 'cancelada' });
  });

  it('esconde Publicar oferta quando não há veículo registado', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    });
    listOfertasByDriver.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Publicar oferta/i })).not.toBeInTheDocument();
    expect(await screen.findByText(/Veículo não registado/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publicar oferta/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registar veículo/i })).toBeInTheDocument();
  });

  it('não mostra Publicar oferta enquanto o estado do veículo está a carregar', () => {
    supabase.from.mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => new Promise(() => {})),
      })),
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('button', { name: /Publicar oferta/i })).not.toBeInTheDocument();
  });

  it('mostra badge Fixa ou Flexível e ida/regresso no card', async () => {
    listOfertasByDriver.mockResolvedValue([
      {
        ...ofertaFixa,
        return_time: '17:00:00',
      },
    ]);

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Fixa')).toBeInTheDocument();
    expect(screen.getByText(/07:15 → 17:00/i)).toBeInTheDocument();
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
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      if (lista[0].created_by === 'pax-1') return [reviewFixture];
      return [];
    });

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
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      return enrichPromise;
    });

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
    expect(screen.queryByText(/Não há propostas para rever/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Não há propostas abertas nesta oferta/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Grupo · 3 pessoas')).not.toBeInTheDocument();

    resolveEnrich([reviewFixture]);
    expect(await screen.findByText('Grupo · 3 pessoas')).toBeInTheDocument();
  });

  it('Aceitar confirma e chama createAgreementFromProposal', async () => {
    listPropostasByOferta.mockResolvedValue([propostaAberta]);
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      if (lista[0].created_by === 'pax-1') return [reviewFixture];
      return [];
    });
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

  it('mostra propostas enviadas pelo motorista (sentido B) com Cancelar e não no inbox', async () => {
    const propostaEnviada = {
      ...propostaAberta,
      id: 'prop-own',
      created_by: 'driver-1',
      n_passageiros_propostos: 1,
      grupo_id: null,
    };
    const reviewEnviada = {
      ...reviewFixture,
      proposta: propostaEnviada,
      titulo: 'Individual',
      membros: [reviewFixture.membros[0]],
    };
    listPropostasByOferta.mockResolvedValue([propostaEnviada]);
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      if (lista[0].created_by === 'driver-1') return [reviewEnviada];
      return [];
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Ver propostas/i }));

    expect(await screen.findByText('Propostas enviadas')).toBeInTheDocument();
    expect(screen.getByText('Individual')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar proposta/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aceitar proposta/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Não há propostas para rever/i)).toBeInTheDocument();
  });

  it('Cancelar proposta enviada chama cancelProposta e actualiza a lista', async () => {
    const propostaEnviada = {
      ...propostaAberta,
      id: 'prop-own',
      created_by: 'driver-1',
      n_passageiros_propostos: 1,
      grupo_id: null,
    };
    const reviewEnviada = {
      ...reviewFixture,
      proposta: propostaEnviada,
      titulo: 'Individual',
      membros: [reviewFixture.membros[0]],
    };
    listPropostasByOferta.mockResolvedValue([propostaEnviada]);
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      if (lista[0].created_by === 'driver-1') return [reviewEnviada];
      return [];
    });
    cancelProposta.mockResolvedValue({ id: 'prop-own', estado: 'cancelada' });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Ver propostas/i }));
    await screen.findByRole('button', { name: /Cancelar proposta/i });

    fireEvent.click(screen.getByRole('button', { name: /Cancelar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cancelamento/i }));

    await waitFor(() => {
      expect(cancelProposta).toHaveBeenCalledWith('prop-own');
    });
    expect(await screen.findByText(/Proposta cancelada/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Cancelar proposta/i })).not.toBeInTheDocument();
    });
    expect(listOfertasByDriver).toHaveBeenCalledTimes(2);
  });

  it('não mostra no inbox propostas criadas pelo próprio motorista (sentido B)', async () => {
    listPropostasByOferta.mockResolvedValue([
      { ...propostaAberta, id: 'prop-own', created_by: 'driver-1' },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      return lista.map((p) => ({
        ...reviewFixture,
        proposta: p,
        titulo: p.created_by === 'driver-1' ? 'Enviada' : 'Inbox',
      }));
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Ver propostas/i }));

    expect(await screen.findByText('Propostas enviadas')).toBeInTheDocument();
    expect(screen.getByText('Enviada')).toBeInTheDocument();
    expect(screen.queryByText('Inbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar proposta/i })).toBeInTheDocument();
  });

  it('lista procuras compatíveis e permite propor acordo (sentido B)', async () => {
    findCompatibleProcuras.mockResolvedValue({
      direct: [
        {
          id: 'pr-9',
          origin_name: 'Kilamba',
          destination_name: 'Mutamba',
          preferred_time: '07:10:00',
          n_candidato: 2,
        },
      ],
      waitlist: [],
      incompatible: [],
    });
    getGrupoByProcura.mockResolvedValue({ id: 'g-9' });
    createProposta.mockResolvedValue({ id: 'prop-b1' });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Procuras compatíveis/i }));

    expect(await screen.findByText('Kilamba')).toBeInTheDocument();
    expect(screen.getByText(/Grupo · 2 pessoas/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Propor acordo/i }));

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-9',
          grupo_id: 'g-9',
          n_passageiros_propostos: 2,
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 120000,
        }),
      );
    });
    expect(await screen.findByText(/Proposta enviada ao passageiro/i)).toBeInTheDocument();
  });

  it('separa direct e waitlist: só direct tem «Propor acordo»', async () => {
    findCompatibleProcuras.mockResolvedValue({
      direct: [
        {
          id: 'pr-direct',
          origin_name: 'Benfica',
          destination_name: 'Baixa',
          preferred_time: '07:00:00',
          n_candidato: 1,
        },
      ],
      waitlist: [
        {
          id: 'pr-wait',
          origin_name: 'Viana',
          destination_name: 'Miramar',
          preferred_time: '07:05:00',
          n_candidato: 4,
        },
      ],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Procuras compatíveis/i }));

    expect(await screen.findByText('Benfica')).toBeInTheDocument();
    expect(screen.getByText('Viana')).toBeInTheDocument();
    expect(screen.getByText(/Lista de espera/i)).toBeInTheDocument();
    expect(screen.getByText(/Grupo maior que os lugares disponíveis/i)).toBeInTheDocument();

    const proporButtons = screen.getAllByRole('button', { name: /Propor acordo/i });
    expect(proporButtons).toHaveLength(1);
  });

  it('waitlist sem direct: não mostra CTA «Propor acordo»', async () => {
    findCompatibleProcuras.mockResolvedValue({
      direct: [],
      waitlist: [
        {
          id: 'pr-wait-only',
          origin_name: 'Cacuaco',
          destination_name: 'Mutamba',
          preferred_time: '07:20:00',
          n_candidato: 5,
        },
      ],
      incompatible: [],
    });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    fireEvent.click(screen.getByRole('button', { name: /Procuras compatíveis/i }));

    expect(await screen.findByText('Cacuaco')).toBeInTheDocument();
    expect(screen.getByText(/Lista de espera/i)).toBeInTheDocument();
    expect(screen.getByText(/Sem lugares suficientes agora/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Propor acordo/i })).not.toBeInTheDocument();
    expect(createProposta).not.toHaveBeenCalled();
  });

  it('oferta flexível mostra «Oferta flexível» sem Origem/Destino fictícios', async () => {
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

    expect(await screen.findByText('Oferta flexível')).toBeInTheDocument();
    expect(screen.queryByText('Origem')).not.toBeInTheDocument();
    expect(screen.queryByText('Destino')).not.toBeInTheDocument();
    expect(screen.getByText(/2 lugares disponíveis/i)).toBeInTheDocument();
    expect(screen.getByText(/Por passageiro/i)).toBeInTheDocument();
  });

  it('oferta flexível lista procuras compatíveis e envia proposta B', async () => {
    listOfertasByDriver.mockResolvedValue([
      {
        id: 'of-flex',
        origin_name: null,
        destination_name: null,
        departure_time: '07:30',
        vagas_disponiveis: 3,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 45000,
        estado: 'disponivel',
        flexibilidade_rota: true,
        dias_semana: [1, 2, 3, 4, 5],
      },
    ]);
    findCompatibleProcuras.mockResolvedValue({
      direct: [
        {
          id: 'pr-flex',
          origin_name: 'Viana',
          destination_name: 'Baixa',
          preferred_time: '07:25:00',
          n_candidato: 1,
        },
      ],
      waitlist: [],
      incompatible: [],
    });
    createProposta.mockResolvedValue({ id: 'prop-flex-b' });

    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Oferta flexível');
    fireEvent.click(screen.getByRole('button', { name: /Procuras compatíveis/i }));

    await waitFor(() => {
      expect(findCompatibleProcuras).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'of-flex',
          flexibilidade_rota: true,
        }),
      );
    });

    expect(await screen.findByText('Viana')).toBeInTheDocument();
    expect(screen.getByText(/Individual/i)).toBeInTheDocument();
    expect(
      screen.getByText(/compatíveis por horário, dias e lugares/i),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Propor acordo/i }));

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-flex',
          procura_id: 'pr-flex',
          grupo_id: null,
          n_passageiros_propostos: 1,
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 45000,
        }),
      );
    });
    expect(await screen.findByText(/Proposta enviada ao passageiro/i)).toBeInTheDocument();
  });

  it('não expõe jargon de produto na UI do hub motorista', async () => {
    render(
      <MemoryRouter>
        <DriverDashboard />
      </MemoryRouter>,
    );

    await screen.findByText('Talatona');
    expectNoUserFacingJargon(document.body.textContent);
  });
});
