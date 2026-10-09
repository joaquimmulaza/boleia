import React, { StrictMode } from 'react';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PassengerDashboard from './PassengerDashboard';
import { createProcura, createProcuraWithGrupo, listProcurasByOwner, updateProcura } from '../services/ProcuraService';
import { findCompatibleOfertas, toProcuraMatchInput } from '../services/MatchingService';
import { listOfertasDisponiveis } from '../services/OfertaService';
import {
  createProposta,
  listPropostasByProcura,
  listPropostasByOferta,
  listOpenPropostasByCreator,
  enrichPropostasForReview,
  cancelProposta,
} from '../services/PropostaService';
import { createAgreementFromProposal, getAgreementsForPassenger } from '../services/AgreementService';
import {
  getGrupoByProcura,
  listMembrosGrupo,
  updateGrupoCapacidade,
  updateMembroRecolha,
} from '../services/GrupoService';
import { listWaitlistByProcura } from '../services/WaitlistService';
import { expectNoUserFacingJargon } from '../test/jargonBan';
import { confirmPropostaSheet } from '../test/confirmPropostaSheet.js';
import { formatKwanza } from '../utils/formatKwanza';
import { COPY_N_FIXO } from '../utils/opportunityProposal';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'pax-1' }, tipoPerfil: 'Passageiro' }),
}));

vi.mock('../services/ProcuraService', () => ({
  createProcura: vi.fn(),
  createProcuraWithGrupo: vi.fn(),
  listProcurasByOwner: vi.fn().mockResolvedValue([]),
  updateProcura: vi.fn(),
  cancelProcura: vi.fn(),
}));

vi.mock('../services/MatchingService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    findCompatibleOfertas: vi.fn().mockResolvedValue({ direct: [], waitlist: [], incompatible: [] }),
  };
});

vi.mock('../services/OfertaService', () => ({
  listOfertasDisponiveis: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/PropostaService', () => ({
  createProposta: vi.fn(),
  listPropostasByProcura: vi.fn().mockResolvedValue([]),
  listPropostasByOferta: vi.fn().mockResolvedValue([]),
  listOpenPropostasByCreator: vi.fn().mockResolvedValue([]),
  enrichPropostasForReview: vi.fn().mockResolvedValue([]),
  rejectProposta: vi.fn(),
  cancelProposta: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  createAgreementFromProposal: vi.fn(),
  getAgreementsForPassenger: vi.fn().mockResolvedValue([]),
}));

const listPendingMock = vi.fn().mockResolvedValue([]);
const drainQueueMock = vi.fn().mockResolvedValue({
  processed: 0,
  remaining: 0,
  conflicts: [],
  successes: [],
});

/** @type {Map<string, Set<(event: MessageEvent) => void>>} */
const swMessageHandlers = new Map();

/** @param {unknown} data */
function dispatchServiceWorkerMessage(data) {
  const event = new MessageEvent('message', { data });
  swMessageHandlers.get('message')?.forEach((handler) => handler(event));
}

vi.mock('../services/offlineQueue', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listPending: (...args) => listPendingMock(...args),
    drainQueue: (...args) => drainQueueMock(...args),
  };
});

vi.mock('../services/WaitlistService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    enqueueWaitlist: vi.fn(),
    listWaitlistByProcura: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/GrupoService', () => ({
  getGrupoByProcura: vi.fn().mockResolvedValue(null),
  listMembrosGrupo: vi.fn().mockResolvedValue([]),
  listGruposAbertos: vi.fn().mockResolvedValue([]),
  listPedidosPendentes: vi.fn().mockResolvedValue([]),
  pedirEntradaGrupo: vi.fn(),
  aprovarEntrada: vi.fn(),
  rejeitarEntrada: vi.fn(),
  grupoTemAcordoActivo: vi.fn().mockResolvedValue(false),
  updateGrupoCapacidade: vi.fn(),
  updateMembroRecolha: vi.fn(),
  apagarGrupo: vi.fn(),
  sairDoGrupo: vi.fn(),
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

/** Expõe location.search para assert de deep-link (Critiquito ENG#33). */
function LocationSearchProbe() {
  const { search } = useLocation();
  return <div data-testid="location-search">{search}</div>;
}

/** Expõe pathname + search para navegação. */
function LocationProbe() {
  const { pathname, search } = useLocation();
  return <div data-testid="location-probe">{`${pathname}${search}`}</div>;
}

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

async function abrirMinhaProcura() {
  const tab = await screen.findByRole('tab', { name: 'A minha procura' });
  if (tab.getAttribute('aria-selected') !== 'true') {
    fireEvent.click(tab);
  }
}

describe('PassengerDashboard — marketplace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    swMessageHandlers.clear();
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      writable: true,
      value: {
        addEventListener(type, handler) {
          if (!swMessageHandlers.has(type)) swMessageHandlers.set(type, new Set());
          swMessageHandlers.get(type).add(handler);
        },
        removeEventListener(type, handler) {
          swMessageHandlers.get(type)?.delete(handler);
        },
        ready: Promise.resolve({}),
      },
    });
    listPendingMock.mockResolvedValue([]);
    drainQueueMock.mockResolvedValue({
      processed: 0,
      remaining: 0,
      conflicts: [],
      successes: [],
    });
    listProcurasByOwner.mockResolvedValue([]);
    getGrupoByProcura.mockResolvedValue(null);
    listMembrosGrupo.mockResolvedValue([]);
    listWaitlistByProcura.mockResolvedValue([]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
    listOfertasDisponiveis.mockResolvedValue([]);
    listPropostasByProcura.mockResolvedValue([]);
    listOpenPropostasByCreator.mockResolvedValue([]);
    enrichPropostasForReview.mockResolvedValue([]);
    getAgreementsForPassenger.mockResolvedValue([]);
  });

  it('sem procura: «Ver boleias» e «Criar procura» com o mesmo estilo', async () => {
    listOfertasDisponiveis.mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
        <LocationProbe />
      </MemoryRouter>,
    );

    const verBoleias = await screen.findByRole('button', { name: 'Ver boleias' });
    const criarProcura = screen.getByRole('button', { name: 'Criar procura' });
    expect(verBoleias.className).toBe(criarProcura.className);

    fireEvent.click(verBoleias);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/explorar');
  });

  it('com acordo activo na oferta mostra CTA «Ver acordo»', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-browse',
        origin_name: 'Viana',
        destination_name: 'Talatona',
        departure_time: '06:45:00',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 24000,
        modo_preco: 'POR_PASSAGEIRO',
        flexibilidade_rota: false,
      },
    ]);
    getAgreementsForPassenger.mockResolvedValue([
      {
        id: 'acordo-99',
        oferta_id: 'of-browse',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: 'pax-1', estado: 'reservado' }],
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
        <LocationProbe />
      </MemoryRouter>,
    );

    const verAcordo = await screen.findByRole('button', { name: 'Ver acordo' });
    expect(screen.queryByRole('button', { name: 'Propor acordo' })).not.toBeInTheDocument();

    fireEvent.click(verAcordo);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/acordos?openAcordoId=acordo-99');
  });

  it('sem procura activa mostra feed de ofertas e grupos (sem form obrigatório)', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-browse',
        origin_name: 'Talatona',
        destination_name: 'Miramar',
        departure_time: '07:15:00',
        vagas_disponiveis: 3,
        valor_mensal_ask_kz: 90000,
        modo_preco: 'POR_PASSAGEIRO',
        flexibilidade_rota: false,
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Explorar')).toBeInTheDocument();
    expect(screen.getByText('Ofertas disponíveis')).toBeInTheDocument();
    expect(screen.getByText('Talatona')).toBeInTheDocument();
    expect(screen.getByText('Miramar')).toBeInTheDocument();
    expect(screen.getByTestId('grupo-descoberta-panel')).toBeInTheDocument();
    expect(screen.getByText('Grupos abertos')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver boleias/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Criar procura/i })).toBeInTheDocument();
    expect(screen.queryByText(/Sem procura activa/i)).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Propor acordo/i })).toBeInTheDocument();
    expect(findCompatibleOfertas).not.toHaveBeenCalled();
    expect(listOfertasDisponiveis).toHaveBeenCalled();
  });

  it('feed browse inclui oferta flexível sem OD inventada', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-flex',
        flexibilidade_rota: true,
        departure_time: '07:00:00',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 70000,
        modo_preco: 'POR_PASSAGEIRO',
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Oferta flexível')).toBeInTheDocument();
    expect(screen.getByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.queryByText(/Sem origem/)).not.toBeInTheDocument();
    expect(screen.queryByText('Publicada')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Origem$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Destino$/)).not.toBeInTheDocument();
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
  });

  function textoKz(valor) {
    return new RegExp(`${formatKwanza(valor).replace(/\s/g, '\\s')}\\sKz`);
  }

  const ofertaExplorar = {
    id: 'of-detalhe',
    flexibilidade_rota: false,
    origin_name: 'Viana',
    destination_name: 'Talatona',
    origin_lat: -8.9,
    origin_lng: 13.18,
    destination_lat: -8.92,
    destination_lng: 13.28,
    departure_time: '07:15',
    dias_semana: [1, 2, 3, 4, 5],
    vagas_disponiveis: 4,
    valor_mensal_ask_kz: 10000,
    modo_preco: 'POR_PASSAGEIRO',
    estado: 'disponivel',
  };

  it('explorar autenticado: o corpo abre o detalhe e não a proposta', async () => {
    listOfertasDisponiveis.mockResolvedValue([ofertaExplorar]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('opportunity-open'));

    expect(screen.getByTestId('opportunity-detail-sheet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.queryByTestId('opportunity-proposal-sheet')).not.toBeInTheDocument();
    expect(screen.queryByTestId('propor-browse-sheet')).not.toBeInTheDocument();
  });

  it('explorar autenticado: o CTA do detalhe abre a proposta', async () => {
    listOfertasDisponiveis.mockResolvedValue([ofertaExplorar]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('opportunity-open'));
    const detalhe = screen.getByTestId('opportunity-detail-sheet');
    fireEvent.click(within(detalhe).getByRole('button', { name: 'Propor acordo' }));

    expect(await screen.findByTestId('opportunity-proposal-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('opportunity-detail-sheet')).not.toBeInTheDocument();
  });

  it('explorar autenticado: detalhe com proposta enviada mostra CTA desactivado', async () => {
    listOfertasDisponiveis.mockResolvedValue([ofertaExplorar]);
    listOpenPropostasByCreator.mockResolvedValue([
      { id: 'prop-1', oferta_id: 'of-detalhe', estado: 'pendente' },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByTestId('opportunity-open'));
    const detalhe = screen.getByTestId('opportunity-detail-sheet');
    const cta = within(detalhe).getByRole('button', { name: 'Proposta enviada' });
    expect(cta).toBeDisabled();
  });

  it('explorar autenticado: o CTA abre a proposta e não o detalhe', async () => {
    listOfertasDisponiveis.mockResolvedValue([ofertaExplorar]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propor acordo' }));

    expect(await screen.findByTestId('opportunity-proposal-sheet')).toBeInTheDocument();
    expect(screen.getByText('Nova proposta')).toBeInTheDocument();
    expect(screen.queryByTestId('opportunity-detail-sheet')).not.toBeInTheDocument();
  });

  it('explorar autenticado abre Nova proposta e o total por passageiro acompanha só o N', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-pp',
        flexibilidade_rota: false,
        origin_name: 'Viana',
        destination_name: 'Talatona',
        origin_lat: -8.9,
        origin_lng: 13.18,
        destination_lat: -8.92,
        destination_lng: 13.28,
        departure_time: '07:15',
        dias_semana: [1, 2, 3, 4, 5],
        vagas_disponiveis: 4,
        valor_mensal_ask_kz: 10000,
        modo_preco: 'POR_PASSAGEIRO',
        estado: 'disponivel',
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('opportunity-card')).toBeInTheDocument();
    expect(screen.queryByText('Publicada')).not.toBeInTheDocument();
    expect(screen.queryByText(/Sem origem/)).not.toBeInTheDocument();
    expect(screen.getByText('Por passageiro')).toBeInTheDocument();
    expect(screen.getByTestId('route-indicator')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Propor acordo' }));

    const sheet = await screen.findByTestId('opportunity-proposal-sheet');
    expect(sheet).toHaveTextContent('Nova proposta');
    expect(sheet).toHaveTextContent('Viana');
    expect(sheet).toHaveTextContent('Talatona');
    expect(within(sheet).getByTestId('proposta-valor-input')).toHaveValue(10000);
    expect(sheet).toHaveTextContent('Total estimado');
    expect(sheet.textContent.replace(/\s/g, ' ')).toMatch(textoKz(10000));
    expect(sheet).not.toHaveTextContent(COPY_N_FIXO);
    const nome = sheet.querySelector('[data-testid="opportunity-place-name"]');
    expect(nome.className).toMatch(/break-words/);
    expect(nome.className).not.toMatch(/ellipsis|truncate|line-clamp|text-fade/);

    fireEvent.click(screen.getByRole('button', { name: 'Mais passageiros' }));
    const depois = sheet.textContent.replace(/\s/g, ' ');
    expect(within(sheet).getByTestId('proposta-valor-input')).toHaveValue(10000);
    expect(depois).toMatch(textoKz(20000));
    expect(depois).not.toMatch(textoKz(30000));
    expect(depois).not.toMatch(/×/);
  });

  it('explorar autenticado com mais de uma pessoa não cria procura sem grupo', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-pp',
        flexibilidade_rota: false,
        origin_name: 'Viana',
        destination_name: 'Talatona',
        origin_lat: -8.9,
        origin_lng: 13.18,
        destination_lat: -8.92,
        destination_lng: 13.28,
        departure_time: '07:15',
        dias_semana: [1, 2, 3, 4, 5],
        vagas_disponiveis: 4,
        valor_mensal_ask_kz: 10000,
        modo_preco: 'POR_PASSAGEIRO',
        estado: 'disponivel',
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propor acordo' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mais passageiros' }));
    fireEvent.click(screen.getByRole('button', { name: 'Enviar proposta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Para propor com mais de uma pessoa é necessário um grupo ligado à procura.',
    );
    expect(screen.getByTestId('opportunity-proposal-sheet')).toBeInTheDocument();
    expect(createProcura).not.toHaveBeenCalled();
    expect(createProposta).not.toHaveBeenCalled();
  });

  it('explorar autenticado em total do acordo mostra um preço e não multiplica por N', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-total',
        flexibilidade_rota: true,
        departure_time: '06:00',
        dias_semana: [1, 2, 3, 4, 5],
        vagas_disponiveis: 4,
        valor_mensal_ask_kz: 30000,
        modo_preco: 'TOTAL_ACORDO',
        estado: 'disponivel',
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Disponível para acordos')).toBeInTheDocument();
    expect(screen.queryByTestId('route-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('Total do acordo')).toBeInTheDocument();
    expect(screen.queryByText(/Sem origem/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Propor acordo' }));
    const sheet = await screen.findByTestId('opportunity-proposal-sheet');
    expect(sheet).toHaveTextContent('Nova proposta');
    expect(sheet).toHaveTextContent('Disponível para acordos');
    expect(within(sheet).getByLabelText(/valor total do acordo na proposta/i)).toHaveValue(30000);
    expect(sheet).not.toHaveTextContent('por passageiro');
    expect(sheet).not.toHaveTextContent(COPY_N_FIXO);
    expect(sheet.textContent.replace(/\s/g, ' ')).not.toMatch(/×/);
    expect(screen.queryByRole('button', { name: 'Mais passageiros' })).not.toBeInTheDocument();
    expect(screen.queryByText('Passageiros')).not.toBeInTheDocument();
  });

  it('browse sem procura: CTA Propor acordo cria procura mínima + proposta', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-browse',
        origin_name: 'Talatona',
        origin_lat: -8.916,
        origin_lng: 13.234,
        destination_name: 'Miramar',
        destination_lat: -8.82,
        destination_lng: 13.25,
        departure_time: '07:15:00',
        vagas_disponiveis: 3,
        valor_mensal_ask_kz: 90000,
        modo_preco: 'POR_PASSAGEIRO',
        flexibilidade_rota: false,
        dias_semana: [1, 2, 3, 4, 5],
      },
    ]);
    createProcura.mockResolvedValue({ id: 'pr-browse', n_candidato: 1, estado: 'activa' });
    createProposta.mockResolvedValue({ id: 'prop-browse' });
    listProcurasByOwner
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'pr-browse', n_candidato: 1, estado: 'activa' }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('browse-ofertas-feed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Propor acordo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar proposta' }));

    await waitFor(() => {
      expect(createProcura).toHaveBeenCalledWith(
        expect.objectContaining({
          origin_name: 'Talatona',
          destination_name: 'Miramar',
          preferred_time: '07:15',
        }),
      );
    });
    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-browse',
          procura_id: 'pr-browse',
          valor_mensal_ask_kz: 90000,
          modo_preco: 'POR_PASSAGEIRO',
        }),
      );
    });
  });

  it('procura flex auto-criada: hub mostra label flexível (sem OD vazios)', async () => {
    listProcurasByOwner.mockResolvedValue([
      {
        id: 'pr-flex',
        estado: 'activa',
        n_candidato: 1,
        preferred_time: '07:00:00',
        origin_name: null,
        origin_lat: null,
        origin_lng: null,
        destination_name: null,
        destination_lat: null,
        destination_lng: null,
        dias_semana: [1, 2, 3, 4, 5],
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('procura-sticky')).toBeInTheDocument();
    expect(screen.getByText('Flexível')).toBeInTheDocument();
    expect(screen.getByText('Sem origem/destino fixos')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A minha procura' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Explorar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('browse-ofertas-feed')).toBeInTheDocument();
  });

  it('com procura activa o Início fica em Explorar e A minha procura troca o feed no mesmo ecrã', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('procura-sticky')).toBeInTheDocument();
    expect(screen.getByTestId('browse-ofertas-feed')).toBeInTheDocument();
    expect(screen.queryByTestId('procura-detail')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'A minha procura' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'A minha procura' }));

    expect(await screen.findByTestId('procura-detail')).toBeInTheDocument();
    expect(screen.queryByTestId('browse-ofertas-feed')).not.toBeInTheDocument();
    expect(screen.queryByTestId('procura-sticky')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar procura' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Explorar' }));
    expect(await screen.findByTestId('browse-ofertas-feed')).toBeInTheDocument();
    expect(screen.getByTestId('procura-sticky')).toBeInTheDocument();
  });

  it('separadores do início ligam o painel e mudam com as setas', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    const explorar = await screen.findByRole('tab', { name: 'Explorar' });
    const procura = screen.getByRole('tab', { name: 'A minha procura' });
    expect(explorar).toHaveAttribute('aria-controls', 'hub-panel-explorar');
    expect(explorar).toHaveAttribute('aria-selected', 'true');
    expect(explorar).toHaveAttribute('tabindex', '0');
    expect(procura).toHaveAttribute('aria-controls', 'hub-panel-procura');
    expect(procura).toHaveAttribute('tabindex', '-1');
    expect(document.getElementById('hub-panel-explorar')).toHaveAttribute('role', 'tabpanel');
    expect(document.getElementById('hub-panel-explorar')).toHaveAttribute('aria-labelledby', explorar.id);

    explorar.focus();
    fireEvent.keyDown(explorar, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(procura).toHaveAttribute('aria-selected', 'true');
      expect(procura).toHaveFocus();
    });
    expect(explorar).toHaveAttribute('tabindex', '-1');
    expect(procura).toHaveAttribute('tabindex', '0');
    expect(document.getElementById('hub-panel-procura')).toHaveAttribute('aria-labelledby', procura.id);
    expect(document.getElementById('hub-panel-explorar')).not.toBeInTheDocument();

    fireEvent.keyDown(procura, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(explorar).toHaveAttribute('aria-selected', 'true');
      expect(explorar).toHaveFocus();
    });
  });

  it('Home ou End no separador já activo não roubam o foco do clique seguinte', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    const explorar = await screen.findByRole('tab', { name: 'Explorar' });
    const procura = screen.getByRole('tab', { name: 'A minha procura' });

    explorar.focus();
    fireEvent.keyDown(explorar, { key: 'Home' });
    expect(explorar).toHaveAttribute('aria-selected', 'true');
    expect(explorar).toHaveFocus();

    fireEvent.click(procura);
    procura.focus();
    await act(async () => {});
    expect(procura).toHaveAttribute('aria-selected', 'true');
    expect(procura).toHaveFocus();
    expect(explorar).not.toHaveFocus();

    fireEvent.keyDown(procura, { key: 'End' });
    expect(procura).toHaveAttribute('aria-selected', 'true');
    expect(procura).toHaveFocus();

    fireEvent.click(explorar);
    explorar.focus();
    await act(async () => {});
    expect(explorar).toHaveAttribute('aria-selected', 'true');
    expect(explorar).toHaveFocus();

    fireEvent.keyDown(procura, { key: 'Home' });
    await waitFor(() => {
      expect(explorar).toHaveAttribute('aria-selected', 'true');
      expect(explorar).toHaveFocus();
    });

    fireEvent.click(procura);
    fireEvent.keyDown(explorar, { key: 'End' });
    await waitFor(() => {
      expect(procura).toHaveAttribute('aria-selected', 'true');
      expect(procura).toHaveFocus();
    });
  });

  it('Propor acordo no Explorar: rota compatível não pede confirmação', async () => {
    listProcurasByOwner.mockResolvedValue([procuraBase]);
    listOfertasDisponiveis.mockResolvedValue([{
      id: 'of-comp',
      origin_name: 'Talatona',
      origin_lat: -8.9,
      origin_lng: 13.1,
      destination_name: 'Miramar',
      destination_lat: -8.8,
      destination_lng: 13.2,
      departure_time: '07:15:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 45000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: false,
    }]);
    createProposta.mockResolvedValue({ id: 'prop-comp' });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propor acordo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(expect.objectContaining({
        oferta_id: 'of-comp',
        procura_id: 'pr-1',
      }));
    });
  });

  it('Propor acordo no Explorar: rota diferente avisa, cancelar não envia e confirmar envia', async () => {
    listProcurasByOwner.mockResolvedValue([{
      ...procuraBase,
      destination_name: 'Centro',
    }]);
    listOfertasDisponiveis.mockResolvedValue([{
      id: 'of-longe',
      origin_name: 'Viana',
      origin_lat: -8.5,
      origin_lng: 13.5,
      destination_name: 'Cacuaco',
      destination_lat: -9.2,
      destination_lng: 13.8,
      departure_time: '07:15:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 45000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: false,
    }]);
    createProposta.mockResolvedValue({ id: 'prop-longe' });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propor acordo' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      'Esta oferta vai de Viana a Cacuaco e a tua procura é Talatona → Centro. Queres propor na mesma?',
    );
    expect(createProposta).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Confirmar proposta/i })).not.toBeInTheDocument();
    expect(createProposta).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Propor acordo' }));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Propor na mesma' }));
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(expect.objectContaining({
        oferta_id: 'of-longe',
        procura_id: 'pr-1',
      }));
    });
  });

  it('Propor acordo no Explorar: oferta flexível com rota diferente não avisa', async () => {
    listProcurasByOwner.mockResolvedValue([{
      ...procuraBase,
      destination_name: 'Centro',
    }]);
    listOfertasDisponiveis.mockResolvedValue([{
      id: 'of-flex-longe',
      origin_name: 'Viana',
      origin_lat: -8.5,
      origin_lng: 13.5,
      destination_name: 'Cacuaco',
      destination_lat: -9.2,
      destination_lng: 13.8,
      departure_time: '07:15:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 45000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: true,
    }]);
    createProposta.mockResolvedValue({ id: 'prop-flex-longe' });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Propor acordo' }));
    expect(screen.queryByRole('dialog', { name: /Rotas diferentes/i })).not.toBeInTheDocument();
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(createProposta).toHaveBeenCalledWith(expect.objectContaining({
        oferta_id: 'of-flex-longe',
        procura_id: 'pr-1',
      }));
    });
  });

  it('carregar procura flex: matching recebe origin_lat null (não 0)', async () => {
    listProcurasByOwner.mockResolvedValue([
      {
        id: 'pr-flex',
        estado: 'activa',
        n_candidato: 1,
        preferred_time: '07:00:00',
        origin_lat: null,
        origin_lng: null,
        destination_lat: null,
        destination_lng: null,
        dias_semana: [1, 2, 3, 4, 5],
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    await waitFor(() => {
      expect(findCompatibleOfertas).toHaveBeenCalledWith(
        expect.objectContaining({
          origin_lat: null,
          destination_lat: null,
          n_candidato: 1,
        }),
      );
    });
    expect(toProcuraMatchInput({ origin_lat: null, destination_lat: null, preferred_time: '07:00' }).origin_lat).toBeNull();
  });

  it('oferta fixa incompleta: abre sheet em vez de erro silencioso', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-incomplete',
        origin_name: 'Talatona',
        destination_name: 'Miramar',
        departure_time: '07:15:00',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 80000,
        modo_preco: 'POR_PASSAGEIRO',
        flexibilidade_rota: false,
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));

    expect(await screen.findByTestId('propor-browse-sheet')).toBeInTheDocument();
    expect(screen.getByText(/Dados em falta para propor/i)).toBeInTheDocument();
    expect(createProcura).not.toHaveBeenCalled();
  });

  it('createProposta falha após createProcura: feedback claro', async () => {
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-browse',
        origin_name: 'Talatona',
        origin_lat: -8.916,
        origin_lng: 13.234,
        destination_name: 'Miramar',
        destination_lat: -8.82,
        destination_lng: 13.25,
        departure_time: '07:15:00',
        vagas_disponiveis: 3,
        valor_mensal_ask_kz: 90000,
        modo_preco: 'POR_PASSAGEIRO',
        flexibilidade_rota: false,
      },
    ]);
    createProcura.mockResolvedValue({ id: 'pr-browse', n_candidato: 1, estado: 'activa' });
    createProposta.mockRejectedValue(new Error('Falha RPC'));
    listProcurasByOwner
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'pr-browse', n_candidato: 1, estado: 'activa', preferred_time: '07:15:00' }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Enviar proposta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/Procura criada, mas não foi possível enviar a proposta/i);
    expect(createProcura).toHaveBeenCalled();
    expect(createProposta).toHaveBeenCalled();
  });

  it('GrupoDescobertaPanel monta sem procura activa', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('grupo-descoberta-panel')).toBeInTheDocument();
    expect(screen.getByText('Grupos abertos')).toBeInTheDocument();
  });

  it('grupos incompletos aparecem no feed browse', async () => {
    const { listGruposAbertos } = await import('../services/GrupoService');
    listGruposAbertos.mockResolvedValue([
      {
        id: 'g-open',
        n_maximo: 4,
        procuras: {
          origin_name: 'Kilamba',
          destination_name: 'Centro',
          preferred_time: '07:30:00',
          n_candidato: 2,
          estado: 'activa',
        },
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Grupo · 2 de 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Pedir entrada/i })).toBeInTheDocument();
  });

  it('empty de matches fala em horário e trajeto — sem «zona»', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase }]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(
      await screen.findByText(/Ainda não há ofertas compatíveis com o teu horário e trajeto/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/zona/i)).not.toBeInTheDocument();
  });

  it('findCompatibleOfertas recebe dias_semana da procura activa', async () => {
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, dias_semana: [1, 2, 3] },
    ]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    await waitFor(() => {
      expect(findCompatibleOfertas).toHaveBeenCalledWith(
        expect.objectContaining({ dias_semana: [1, 2, 3] }),
      );
    });
  });

  it('oferta flexível compatível mostra «Oferta flexível» sem Origem/Destino fictícios', async () => {
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, dias_semana: [1, 2, 3, 4, 5] },
    ]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [
        {
          id: 'of-flex',
          flexibilidade_rota: true,
          departure_time: '07:15:00',
          vagas_disponiveis: 4,
          valor_mensal_ask_kz: 80000,
          modo_preco: 'POR_PASSAGEIRO',
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

    await abrirMinhaProcura();

    expect(await screen.findByText('Oferta flexível')).toBeInTheDocument();
    expect(screen.queryByText(/^Origem$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Destino$/)).not.toBeInTheDocument();
  });

  it('com procura activa mostra painel para criar grupo', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));
    await confirmPropostaSheet();

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

  it('matching usa N_actual (membros) para capacidade, não n_candidato desactualizado', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 4 }]);
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', nome: 'Colegas', n_maximo: 4 });
    listMembrosGrupo.mockResolvedValue([
      { id: 'm-1', passenger_id: 'pax-1', estado: 'activo', ordem_insercao: 0 },
      { id: 'm-2', passenger_id: 'pax-2', estado: 'activo', ordem_insercao: 1 },
    ]);
    findCompatibleOfertas.mockResolvedValue({ direct: [ofertaDirect], waitlist: [], incompatible: [] });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    await waitFor(() => {
      expect(findCompatibleOfertas).toHaveBeenCalledWith(
        expect.objectContaining({ n_candidato: 2 }),
      );
    });
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

    await abrirMinhaProcura();

    fireEvent.click(await screen.findByRole('button', { name: /Propor acordo/i }));
    await confirmPropostaSheet();

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

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

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
      listPropostasByProcura.mockResolvedValue([
        {
          id: 'prop-out',
          estado: 'cancelada',
          created_by: 'pax-1',
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 100000,
          n_passageiros_propostos: 1,
        },
      ]);
      return { id, estado: 'cancelada' };
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

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
    expect(await screen.findByText('Propostas concluídas')).toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar proposta/i })).not.toBeInTheDocument();
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

  it('Guardar procura ignora double-submit enquanto o pedido está em curso', async () => {
    let resolveCreate;
    createProcura.mockImplementation(
      () => new Promise((resolve) => {
        resolveCreate = () => resolve({ ...procuraBase, id: 'pr-once' });
      }),
    );

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

    const btn = screen.getByRole('button', { name: /Guardar procura/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(createProcura).toHaveBeenCalledTimes(1);
    expect(btn).toBeDisabled();

    resolveCreate();
    await waitFor(() => {
      expect(createProcura).toHaveBeenCalledTimes(1);
    });
  });

  it('formulário usa TimeInput 24h para hora preferida', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Criar procura/i }));

    const hora = screen.getByLabelText('Hora preferida');
    expect(hora).toHaveAttribute('type', 'time');
    expect(hora).toHaveAttribute('lang', 'pt-PT');
    expect(hora).toHaveClass('time-input-24h');
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

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

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

    await abrirMinhaProcura();

    expect(await screen.findByText('Propostas recebidas')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Aceitar proposta/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-b');
    });
  });

  it('aceitar proposta com procura activa avisa fecho e mostra toast exacto', async () => {
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
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

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar proposta/i }));
    expect(screen.getByTestId('aviso-procura-fecha')).toHaveTextContent(
      'Ao aceitar, a tua procura fica fechada.',
    );
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(
      'Procura fechada — tens acordo activo.',
    );
  });

  it('aceite offline enfileirado não mostra toast de procura fechada', async () => {
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    createAgreementFromProposal.mockImplementation(async () => {
      listPendingMock.mockResolvedValue([
        {
          rpc: 'accept_proposal',
          args: { p_proposta_id: 'prop-b' },
          idempotency_key: 'idem-offline',
        },
      ]);
      return {
        id: 'prop-b',
        offlineQueued: true,
        idempotency_key: 'idem-offline',
      };
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');
    });

    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(
      'Sem rede. O aceite vai ser enviado quando a rede voltar.',
    );
    expect(screen.getByTestId('passenger-feedback')).not.toHaveTextContent(
      'Procura fechada — tens acordo activo.',
    );
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');
    expect(screen.getByRole('button', { name: /Aceitar proposta/i })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Ver acordo' })).not.toBeInTheDocument();
  });

  it('com accept na fila após reload mantém chip A enviar e Aceitar desactivado', async () => {
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    listPendingMock.mockResolvedValue([
      { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');
    expect(screen.getByRole('button', { name: /Aceitar proposta/i })).toBeDisabled();
  });

  it('replay offline com sucesso remove chip A enviar após sync', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-b',
        estado: 'aberta',
        created_by: 'driver-1',
        oferta_id: 'of-browse',
        procura_id: 'pr-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    let acceptStillQueued = true;
    listPendingMock.mockImplementation(async () => {
      if (!acceptStillQueued) return [];
      return [{ rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } }];
    });
    drainQueueMock.mockImplementation(async () => {
      acceptStillQueued = false;
      return {
        processed: 1,
        remaining: 0,
        conflicts: [],
        successes: [
          {
            item: { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } },
            status: 200,
            data: 'acordo-1',
          },
        ],
      };
    });
    getAgreementsForPassenger.mockResolvedValue([
      {
        id: 'acordo-1',
        oferta_id: 'of-browse',
        estado: 'activo',
        acordos_passageiros: [{ passenger_id: 'pax-1', estado: 'reservado' }],
      },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');

    await act(async () => {
      acceptStillQueued = false;
      dispatchServiceWorkerMessage({
        type: 'OFFLINE_SYNC_COMPLETE',
        summary: {
          processed: 1,
          remaining: 0,
          conflicts: [],
          successes: [
            {
              item: { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } },
              status: 200,
              data: 'acordo-1',
            },
          ],
        },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText('A enviar…')).not.toBeInTheDocument();
      expect(screen.getByTestId('passenger-feedback')).toHaveTextContent(
        'Procura fechada — tens acordo activo.',
      );
    });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('replay offline rejeitado (4xx) mostra erro e reactiva Aceitar', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    let acceptStillQueuedReject = true;
    listPendingMock.mockImplementation(async () => {
      if (!acceptStillQueuedReject) return [];
      return [{ rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } }];
    });
    drainQueueMock.mockImplementation(async () => {
      acceptStillQueuedReject = false;
      return {
        processed: 1,
        remaining: 0,
        conflicts: [
          {
            item: { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } },
            status: 409,
            errorText: 'proposta invalida',
          },
        ],
        successes: [],
      };
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');

    await act(async () => {
      acceptStillQueuedReject = false;
      dispatchServiceWorkerMessage({
        type: 'OFFLINE_SYNC_COMPLETE',
        summary: {
          processed: 1,
          remaining: 0,
          conflicts: [
            {
              item: { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } },
              status: 409,
              errorText: 'proposta invalida',
            },
          ],
          successes: [],
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('passenger-feedback')).toHaveTextContent(
        'Não foi possível aceitar — a oferta mudou.',
      );
    });
    expect(screen.getByRole('button', { name: /Aceitar proposta/i })).not.toBeDisabled();
    expect(screen.queryByText('A enviar…')).not.toBeInTheDocument();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('sync online: drain da rede com 4xx não mostra toast de sucesso', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-b',
        estado: 'aberta',
        created_by: 'driver-1',
        oferta_id: 'of-browse',
        procura_id: 'pr-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    let acceptStillQueuedOnline = true;
    listPendingMock.mockImplementation(async () => {
      if (!acceptStillQueuedOnline) return [];
      return [{ rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } }];
    });
    drainQueueMock.mockImplementation(async () => {
      acceptStillQueuedOnline = false;
      return {
        processed: 1,
        remaining: 0,
        conflicts: [
          {
            item: { rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } },
            status: 409,
            errorText: 'proposta invalida',
          },
        ],
        successes: [],
      };
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('passenger-feedback')).toHaveTextContent(
        'Não foi possível aceitar — a oferta mudou.',
      );
    });
    expect(screen.getByTestId('passenger-feedback')).not.toHaveTextContent(
      'Procura fechada — tens acordo activo.',
    );
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it('summary vazio após drain não mostra toast de sucesso', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-b',
        estado: 'aberta',
        created_by: 'driver-1',
        procura_id: 'pr-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    let acceptStillQueuedEmpty = true;
    listPendingMock.mockImplementation(async () => {
      if (!acceptStillQueuedEmpty) return [];
      return [{ rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } }];
    });
    drainQueueMock.mockImplementation(async () => {
      acceptStillQueuedEmpty = false;
      return { processed: 0, remaining: 0, conflicts: [], successes: [] };
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');

    await act(async () => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(drainQueueMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByText('A enviar…')).not.toBeInTheDocument();
    });
    expect(screen.queryByText('Procura fechada — tens acordo activo.')).not.toBeInTheDocument();
    expect(screen.queryByText('Proposta aceite. Acordo criado.')).not.toBeInTheDocument();
  });

  it('visibilitychange com drain vazio não mostra toast de sucesso', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-b',
        estado: 'aberta',
        created_by: 'driver-1',
        procura_id: 'pr-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    let acceptStillQueuedVis = true;
    listPendingMock.mockImplementation(async () => {
      if (!acceptStillQueuedVis) return [];
      return [{ rpc: 'accept_proposal', args: { p_proposta_id: 'prop-b' } }];
    });
    drainQueueMock.mockImplementation(async () => {
      acceptStillQueuedVis = false;
      return { processed: 0, remaining: 0, conflicts: [], successes: [] };
    });

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByTestId('proposta-estado-chip')).toHaveTextContent('A enviar…');

    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(drainQueueMock).toHaveBeenCalled();
    });
    expect(screen.queryByText('Procura fechada — tens acordo activo.')).not.toBeInTheDocument();
  });

  it('recusa do servidor ao aceitar mantém procura aberta e mostra copy de erro', async () => {
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    createAgreementFromProposal.mockRejectedValue(new Error('Sem vagas'));

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(
      'Não foi possível aceitar — a oferta mudou.',
    );
    expect(await screen.findByRole('button', { name: /Aceitar proposta/i })).toBeInTheDocument();
    expect(screen.getByText('Activa')).toBeInTheDocument();
  });

  it('erro genérico ao aceitar mostra copy neutra', async () => {
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );
    createAgreementFromProposal.mockRejectedValue(new Error('Erro inesperado'));

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(await screen.findByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(
      'Não foi possível aceitar. Tenta outra vez.',
    );
  });

  it('após aceitar proposta actualiza inbox e CTA Ver acordo sem reload', async () => {
    const propostaAberta = {
      id: 'prop-b',
      estado: 'aberta',
      created_by: 'driver-1',
      oferta_id: 'of-browse',
      modo_preco: 'TOTAL_ACORDO',
      valor_mensal_ask_kz: 120000,
      n_passageiros_propostos: 1,
    };
    const reviewFixture = {
      proposta: propostaAberta,
      titulo: 'Individual',
      membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
      pricing: {
        valor_mensal_total_kz: 120000,
        valor_mensal_por_passageiro_kz: 120000,
        quotas: [120000],
        temResto: false,
      },
      avisoComposicao: null,
    };

    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-browse',
        origin_name: 'Viana',
        destination_name: 'Talatona',
        departure_time: '06:45:00',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 120000,
        modo_preco: 'TOTAL_ACORDO',
        flexibilidade_rota: false,
      },
    ]);
    listPropostasByProcura
      .mockResolvedValueOnce([propostaAberta])
      .mockResolvedValue([{ ...propostaAberta, estado: 'aceite' }]);
    enrichPropostasForReview.mockImplementation(async (lista) => {
      if (!lista?.length) return [];
      if (lista[0].estado === 'aceite') {
        return [{ ...reviewFixture, proposta: lista[0] }];
      }
      return [reviewFixture];
    });
    getAgreementsForPassenger
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        {
          id: 'acordo-pos-aceite',
          oferta_id: 'of-browse',
          estado: 'activo',
          acordos_passageiros: [{ passenger_id: 'pax-1', estado: 'reservado' }],
        },
      ]);
    createAgreementFromProposal.mockResolvedValue({ id: 'acordo-pos-aceite' });

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByRole('button', { name: /Aceitar proposta/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-b');
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Aceitar proposta/i })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Propostas concluídas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Explorar' }));
    expect(await screen.findByRole('button', { name: 'Ver acordo' })).toBeInTheDocument();
    expect(listPropostasByProcura.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(getAgreementsForPassenger.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('aceitar contraproposta: proposta enviada de 20k deixa de mostrar Aguarda resposta sem reload', async () => {
    const ofertaBrowse = {
      id: 'of-browse',
      origin_name: 'Viana Municipality, Angola',
      destination_name: 'Talatona Municipality, Angola',
      departure_time: '06:30:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 24000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: false,
    };
    const propostaPassageiro = {
      id: 'prop-pax',
      estado: 'aberta',
      created_by: 'pax-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 20000,
      n_passageiros_propostos: 1,
    };
    const contrapropostaMotorista = {
      id: 'prop-mot-contra',
      estado: 'aberta',
      created_by: 'driver-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 22000,
      n_passageiros_propostos: 1,
    };

    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, id: 'pr-1', n_candidato: 1 }]);
    listOfertasDisponiveis.mockResolvedValue([ofertaBrowse]);
    listPropostasByProcura.mockResolvedValue([propostaPassageiro, contrapropostaMotorista]);
    listOpenPropostasByCreator
      .mockResolvedValueOnce([{ id: 'prop-pax', oferta_id: 'of-browse', estado: 'aberta' }])
      .mockResolvedValue([]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
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
      })),
    );
    getAgreementsForPassenger.mockResolvedValue([]);
    createAgreementFromProposal.mockResolvedValue({
      id: 'acordo-pos-contra',
      oferta_id: 'of-browse',
      estado: 'activo',
    });

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByText('Aguarda resposta')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-mot-contra');
    });

    await waitFor(() => {
      expect(screen.queryByText('Aguarda resposta')).not.toBeInTheDocument();
    });
    expect(listOpenPropostasByCreator).toHaveBeenCalledTimes(2);
  });

  it('aceitar contraproposta na mesma instância: Ver acordo quando refetch de acordos chega tarde', async () => {
    const ofertaBrowse = {
      id: 'of-browse',
      origin_name: 'Viana Municipality, Angola',
      destination_name: 'Talatona Municipality, Angola',
      departure_time: '06:30:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 24000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: false,
    };
    const propostaPassageiro = {
      id: 'prop-pax',
      estado: 'aberta',
      created_by: 'pax-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 20000,
      n_passageiros_propostos: 1,
    };
    const contrapropostaMotorista = {
      id: 'prop-mot-contra',
      estado: 'aberta',
      created_by: 'driver-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 22000,
      n_passageiros_propostos: 1,
    };

    listProcurasByOwner
      .mockResolvedValueOnce([{ ...procuraBase, n_candidato: 1 }])
      .mockResolvedValue([]);
    listOfertasDisponiveis
      .mockResolvedValueOnce([ofertaBrowse])
      .mockResolvedValue([{ ...ofertaBrowse, vagas_disponiveis: 2 }]);
    listPropostasByProcura.mockResolvedValue([propostaPassageiro, contrapropostaMotorista]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
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
      })),
    );
    getAgreementsForPassenger.mockResolvedValue([]);
    createAgreementFromProposal.mockResolvedValue({
      id: 'acordo-pos-contra',
      oferta_id: 'of-browse',
      estado: 'activo',
    });

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
        <LocationProbe />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    expect(await screen.findByText('Propostas recebidas')).toBeInTheDocument();
    expect(screen.getByText('Propostas enviadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-mot-contra');
    });
    expect(await screen.findByTestId('passenger-feedback')).toHaveTextContent(
      'Procura fechada — tens acordo activo.',
    );

    expect(await screen.findByRole('button', { name: 'Ver acordo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propor acordo' })).not.toBeInTheDocument();
    expect(screen.getByText('2 lugares disponíveis')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver acordo' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/acordos?openAcordoId=acordo-pos-contra',
    );
  });

  it('após aceite mantém CTA Ver acordo quando refetch do browse falha', async () => {
    const ofertaBrowse = {
      id: 'of-browse',
      origin_name: 'Viana Municipality, Angola',
      destination_name: 'Talatona Municipality, Angola',
      departure_time: '06:30:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 24000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: false,
    };
    const propostaPassageiro = {
      id: 'prop-pax',
      estado: 'aberta',
      created_by: 'pax-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 20000,
      n_passageiros_propostos: 1,
    };
    const contrapropostaMotorista = {
      id: 'prop-mot-contra',
      estado: 'aberta',
      created_by: 'driver-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 22000,
      n_passageiros_propostos: 1,
    };

    listProcurasByOwner
      .mockResolvedValueOnce([{ ...procuraBase, n_candidato: 1 }])
      .mockResolvedValue([]);
    listOfertasDisponiveis
      .mockResolvedValueOnce([ofertaBrowse])
      .mockRejectedValueOnce(new Error('Falha de rede no browse'));
    listPropostasByProcura.mockResolvedValue([propostaPassageiro, contrapropostaMotorista]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
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
      })),
    );
    getAgreementsForPassenger.mockResolvedValue([]);
    createAgreementFromProposal.mockResolvedValue({
      id: 'acordo-pos-contra',
      oferta_id: 'of-browse',
      estado: 'activo',
    });

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();
    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-mot-contra');
    });

    await waitFor(() => {
      expect(listOfertasDisponiveis.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    expect(await screen.findByRole('button', { name: 'Ver acordo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propor acordo' })).not.toBeInTheDocument();
  });

  it('após aceitar contraproposta mantém CTA Ver acordo com refetch de acordos em corrida', async () => {
    const ofertaBrowse = {
      id: 'of-browse',
      origin_name: 'Viana Municipality, Angola',
      destination_name: 'Talatona Municipality, Angola',
      departure_time: '06:30:00',
      vagas_disponiveis: 3,
      valor_mensal_ask_kz: 24000,
      modo_preco: 'POR_PASSAGEIRO',
      flexibilidade_rota: false,
    };
    const propostaPassageiro = {
      id: 'prop-pax',
      estado: 'aberta',
      created_by: 'pax-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 20000,
      n_passageiros_propostos: 1,
    };
    const contrapropostaMotorista = {
      id: 'prop-mot-contra',
      estado: 'aberta',
      created_by: 'driver-1',
      oferta_id: 'of-browse',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 22000,
      n_passageiros_propostos: 1,
    };
    const acordoPosAceite = {
      id: 'acordo-pos-contra',
      oferta_id: 'of-browse',
      estado: 'activo',
      acordos_passageiros: [{ passenger_id: 'pax-1', estado: 'reservado' }],
    };

    /** @type {((value: unknown[]) => void) | null} */
    let resolverRefetchAcordos = null;
    const refetchAcordosGate = new Promise((resolve) => {
      resolverRefetchAcordos = resolve;
    });

    listProcurasByOwner
      .mockResolvedValueOnce([{ ...procuraBase, n_candidato: 1, owner_id: 'pax-1' }])
      .mockResolvedValueOnce([{ ...procuraBase, n_candidato: 1, owner_id: 'pax-1' }])
      .mockResolvedValue([]);
    getGrupoByProcura.mockResolvedValue({ id: 'g-1', procura_id: 'pr-1', n_maximo: 4 });
    updateGrupoCapacidade.mockResolvedValue({ id: 'g-1', n_maximo: 3 });
    updateMembroRecolha.mockResolvedValue({ id: 'm-1' });
    listMembrosGrupo.mockResolvedValue([
      {
        id: 'm-1',
        passenger_id: 'pax-1',
        estado: 'activo',
        ordem_insercao: 0,
        pickup_name: '',
        perfis: { nome_completo: 'Tu' },
      },
    ]);
    listOfertasDisponiveis.mockResolvedValue([ofertaBrowse]);
    listPropostasByProcura.mockResolvedValue([propostaPassageiro, contrapropostaMotorista]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
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
      })),
    );
    getAgreementsForPassenger.mockImplementation(async () => {
      const callNum = getAgreementsForPassenger.mock.calls.length;
      if (callNum === 1) return [];
      if (callNum === 2) return refetchAcordosGate;
      return [acordoPosAceite];
    });
    createAgreementFromProposal.mockResolvedValue({
      id: 'acordo-pos-contra',
      oferta_id: 'of-browse',
      estado: 'activo',
    });

    render(
      <MemoryRouter initialEntries={['/passageiro']}>
        <PassengerDashboard />
        <LocationProbe />
      </MemoryRouter>,
    );

    await screen.findByRole('tab', { name: 'Explorar' });
    await abrirMinhaProcura();
    expect(await screen.findByRole('button', { name: /Aceitar proposta/i })).toBeInTheDocument();
    expect(screen.getByText('Propostas enviadas')).toBeInTheDocument();

    fireEvent.click(await screen.findByRole('button', { name: 'Mais acções do grupo' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Editar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Guardar' }));

    fireEvent.click(screen.getByRole('button', { name: /Aceitar proposta/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar$/i }));

    await waitFor(() => {
      expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-mot-contra');
    });

    expect(await screen.findByRole('button', { name: 'Ver acordo' })).toBeInTheDocument();

    await act(async () => {
      resolverRefetchAcordos?.([]);
    });

    expect(screen.getByRole('button', { name: 'Ver acordo' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Propor acordo' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver acordo' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent(
      '/acordos?openAcordoId=acordo-pos-contra',
    );
  });

  it('mount não-silent pendente: refresh subsequente liberta loading sem spinner preso', async () => {
    /** @type {((value: unknown[]) => void) | null} */
    let resolveMountPending = null;
    const mountPendingGate = new Promise((resolve) => {
      resolveMountPending = resolve;
    });

    listProcurasByOwner.mockImplementation(async () => {
      if (listProcurasByOwner.mock.calls.length === 1) return mountPendingGate;
      return [];
    });
    listOfertasDisponiveis.mockResolvedValue([]);

    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/passageiro']}>
          <PassengerDashboard />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();

    await screen.findByText('Ofertas disponíveis');

    await act(async () => {
      resolveMountPending?.([]);
    });

    expect(screen.getByText('Ofertas disponíveis')).toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('mostra bucket lista de espera com empty state quando sem inscrições', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listWaitlistByProcura.mockResolvedValue([]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByTestId('waitlist-bucket')).toBeInTheDocument();
    expect(screen.getByText('Lista de espera')).toBeInTheDocument();
    expect(screen.getByText(/Ainda não estás em nenhuma lista de espera/i)).toBeInTheDocument();
  });

  it('mostra propostas rejeitadas na secção concluídas', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-rej',
        estado: 'rejeitada',
        created_by: 'pax-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 50000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 50000 }],
        pricing: {
          valor_mensal_total_kz: 50000,
          valor_mensal_por_passageiro_kz: 50000,
          quotas: [50000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByText('Propostas concluídas')).toBeInTheDocument();
    expect(screen.getByText('Rejeitada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cancelar proposta/i })).not.toBeInTheDocument();
  });

  it('proposta enviada aberta mostra chip Aguarda resposta', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-open',
        estado: 'aberta',
        created_by: 'pax-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 50000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 50000 }],
        pricing: {
          valor_mensal_total_kz: 50000,
          valor_mensal_por_passageiro_kz: 50000,
          quotas: [50000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByText('Aguarda resposta')).toBeInTheDocument();
  });

  it('mostra proposta aceite na secção concluídas (historico)', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-aceite',
        estado: 'aceite',
        created_by: 'driver-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 50000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 50000 }],
        pricing: {
          valor_mensal_total_kz: 50000,
          valor_mensal_por_passageiro_kz: 50000,
          quotas: [50000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByText('Propostas concluídas')).toBeInTheDocument();
    expect(screen.getByText('Aceite')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aceitar proposta/i })).not.toBeInTheDocument();
  });

  it('não expõe jargon de produto na UI do hub passageiro', async () => {
    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Ofertas disponíveis')).toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });

  it('contagem de ofertas compatíveis reflecte só direct (não waitlist do bucket separado)', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [ofertaDirect],
      waitlist: [
        {
          id: 'of-w1',
          origin_name: 'Kilamba',
          destination_name: 'Maianga',
          departure_time: '07:00:00',
          vagas_disponiveis: 0,
          valor_mensal_ask_kz: 80000,
          modo_preco: 'POR_PASSAGEIRO',
        },
        {
          id: 'of-w2',
          origin_name: 'Viana',
          destination_name: 'Centro',
          departure_time: '07:30:00',
          vagas_disponiveis: 0,
          valor_mensal_ask_kz: 70000,
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

    await abrirMinhaProcura();

    expect(await screen.findByText('Ofertas compatíveis')).toBeInTheDocument();
    expect(screen.getByText('1 oferta compatível')).toBeInTheDocument();
    expect(screen.queryByText('3 ofertas compatíveis')).not.toBeInTheDocument();
  });

  it('não mostra órfãos cancelada/promovida na lista de espera', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    findCompatibleOfertas.mockResolvedValue({ direct: [], waitlist: [], incompatible: [] });
    listWaitlistByProcura.mockResolvedValue([
      { id: 'w-cancel', oferta_id: 'of-old-1', procura_id: 'pr-1', estado: 'cancelada' },
      { id: 'w-promo', oferta_id: 'of-old-2', procura_id: 'pr-1', estado: 'promovida' },
      { id: 'w-activa', oferta_id: 'of-old-3', procura_id: 'pr-1', estado: 'activa' },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByTestId('waitlist-bucket')).toBeInTheDocument();
    expect(screen.getAllByTestId('waitlist-entry-orfa')).toHaveLength(1);
    expect(screen.getByText('Em espera')).toBeInTheDocument();
    expect(screen.queryByText('Inscrição activa nesta oferta')).toBeInTheDocument();
  });

  it('mostra Editar e Cancelar procura quando activa', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByRole('button', { name: /Editar procura/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancelar procura/i })).toBeInTheDocument();
  });

  it('não mostra Editar quando a procura está fechada', async () => {
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, estado: 'fechada', n_candidato: 1 },
    ]);

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Explorar')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar procura/i })).not.toBeInTheDocument();
  });

  it('editar teto grava sem modal e recarrega matching', async () => {
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, teto_mensal_kz: 25000 },
    ]);
    updateProcura.mockResolvedValue({
      ...procuraBase,
      teto_mensal_kz: 18000,
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    fireEvent.click(await screen.findByRole('button', { name: /Editar procura/i }));
    expect(screen.getByRole('button', { name: /Guardar alterações/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Tipo de procura')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Teto mensal por passageiro'), {
      target: { name: 'teto_mensal_kz', value: '18000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar alterações/i }));

    await waitFor(() => {
      expect(updateProcura).toHaveBeenCalledWith(
        'pr-1',
        expect.objectContaining({ teto_mensal_kz: 18000, preferred_time: '07:15' }),
      );
    });
    expect(screen.queryByText(/deixam de corresponder/i)).not.toBeInTheDocument();
    await waitFor(() => {
      expect(findCompatibleOfertas).toHaveBeenCalled();
    });
  });

  it('editar horário incompatível pede confirmação antes de gravar', async () => {
    const ofertaFixa = {
      id: 'of-1',
      origin_name: 'Talatona',
      destination_name: 'Miramar',
      departure_time: '07:15:00',
      origin_lat: -8.9,
      origin_lng: 13.1,
      destination_lat: -8.8,
      destination_lng: 13.2,
      vagas_disponiveis: 4,
      flexibilidade_rota: false,
      dias_semana: [1, 2, 3, 4, 5],
    };
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, dias_semana: [1, 2, 3, 4, 5] },
    ]);
    findCompatibleOfertas.mockResolvedValue({
      direct: [ofertaFixa],
      waitlist: [],
      incompatible: [],
    });
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-hora',
        estado: 'aberta',
        created_by: 'pax-1',
        oferta_id: 'of-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 20000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (list) =>
      (list || []).map((proposta) => ({
        proposta,
        titulo: '1 passageiro',
        membros: [],
        pricing: {
          valor_mensal_total_kz: 20000,
          valor_mensal_por_passageiro_kz: 20000,
          quotas: [20000],
        },
      })),
    );
    updateProcura.mockResolvedValue({
      ...procuraBase,
      preferred_time: '08:00:00',
    });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    fireEvent.click(await screen.findByRole('button', { name: /Editar procura/i }));
    fireEvent.change(screen.getByLabelText('Hora preferida'), {
      target: { name: 'preferred_time', value: '08:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Guardar alterações/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('1 proposta deixa de corresponder')).toBeInTheDocument();
    expect(updateProcura).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Actualizar mesmo assim/i }));
    await waitFor(() => {
      expect(updateProcura).toHaveBeenCalledWith(
        'pr-1',
        expect.objectContaining({ preferred_time: '08:00' }),
      );
    });
  });

  it('deep-link focus=propostas sem procura activa abre propostas (não Explorar)', async () => {
    listProcurasByOwner.mockResolvedValue([]);
    listOfertasDisponiveis.mockResolvedValue([
      {
        id: 'of-browse',
        origin_name: 'Talatona',
        destination_name: 'Miramar',
        departure_time: '07:15:00',
        vagas_disponiveis: 2,
        valor_mensal_ask_kz: 80000,
        modo_preco: 'TOTAL_ACORDO',
      },
    ]);
    listPropostasByOferta.mockResolvedValue([
      {
        id: 'prop-dl',
        estado: 'aberta',
        created_by: 'driver-1',
        oferta_id: 'of-1',
        procura_id: 'pr-archived',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
        proposta: p,
        titulo: 'Individual',
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <MemoryRouter
        initialEntries={[
          '/passageiro?focus=propostas&propostaId=prop-dl&openOfertaId=of-1',
        ]}
      >
        <PassengerDashboard />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listPropostasByOferta).toHaveBeenCalledWith('of-1');
    });

    expect(await screen.findByText('Propostas recebidas')).toBeInTheDocument();
    expect(screen.queryByTestId('browse-ofertas-feed')).not.toBeInTheDocument();
    expect(screen.queryByText('Explorar')).not.toBeInTheDocument();

    const search = screen.getByTestId('location-search').textContent || '';
    expect(search).toContain('focus=propostas');
    expect(search).toContain('propostaId=prop-dl');
    expect(search).toContain('openOfertaId=of-1');

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('deep-link proposal_received preserva query params na URL', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-dl',
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
        membros: [{ passenger_id: 'pax-1', nome: 'Tu', quota_mensal_kz: 120000 }],
        pricing: {
          valor_mensal_total_kz: 120000,
          valor_mensal_por_passageiro_kz: 120000,
          quotas: [120000],
          temResto: false,
        },
        avisoComposicao: null,
      })),
    );

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <MemoryRouter
        initialEntries={[
          '/passageiro?focus=propostas&propostaId=prop-dl&openOfertaId=of-1',
        ]}
      >
        <PassengerDashboard />
        <LocationSearchProbe />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByText('Propostas recebidas')).toBeInTheDocument();
    const search = screen.getByTestId('location-search').textContent || '';
    expect(search).toContain('focus=propostas');
    expect(search).toContain('propostaId=prop-dl');
    expect(search).toContain('openOfertaId=of-1');

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('contra-proposta visível mesmo com enviada aberta à mesma oferta; submit cancela+cria', async () => {
    listProcurasByOwner.mockResolvedValue([{ ...procuraBase, n_candidato: 1 }]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-in',
        estado: 'aberta',
        created_by: 'driver-1',
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 38000,
        n_passageiros_propostos: 1,
      },
      {
        id: 'prop-out',
        estado: 'aberta',
        created_by: 'pax-1',
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (lista) =>
      (lista || []).map((p) => ({
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
      })),
    );
    findCompatibleOfertas.mockResolvedValue({
      direct: [{ ...ofertaDirect, modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 45000 }],
      waitlist: [],
      incompatible: [],
    });
    cancelProposta.mockResolvedValue({ id: 'prop-out', estado: 'cancelada' });
    createProposta.mockResolvedValue({ id: 'prop-counter', estado: 'aberta' });

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByRole('button', { name: /Fazer contra-proposta/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fazer contra-proposta/i }));
    fireEvent.change(await screen.findByTestId('proposta-valor-input'), { target: { value: '42000' } });
    await confirmPropostaSheet();

    await waitFor(() => {
      expect(cancelProposta).toHaveBeenCalledWith('prop-out');
      expect(createProposta).toHaveBeenCalledWith(
        expect.objectContaining({
          oferta_id: 'of-1',
          procura_id: 'pr-1',
          valor_mensal_ask_kz: 42000,
        }),
      );
    });
  });

  it('mostra chip Acima do teto quando a proposta excede o teto', async () => {
    listProcurasByOwner.mockResolvedValue([
      { ...procuraBase, n_candidato: 1, teto_mensal_kz: 18000 },
    ]);
    listPropostasByProcura.mockResolvedValue([
      {
        id: 'prop-teto',
        estado: 'aberta',
        created_by: 'pax-1',
        oferta_id: 'of-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 25000,
        n_passageiros_propostos: 1,
      },
    ]);
    enrichPropostasForReview.mockImplementation(async (list) =>
      (list || []).map((proposta) => ({
        proposta,
        titulo: '1 passageiro',
        membros: [],
        pricing: {
          valor_mensal_total_kz: 25000,
          valor_mensal_por_passageiro_kz: 25000,
          quotas: [25000],
        },
      })),
    );

    render(
      <MemoryRouter>
        <PassengerDashboard />
      </MemoryRouter>,
    );

    await abrirMinhaProcura();

    expect(await screen.findByTestId('chip-acima-do-teto')).toHaveTextContent('Acima do teto');
  });
});
