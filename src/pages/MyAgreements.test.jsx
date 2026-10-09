import React from 'react';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import { expectNoUserFacingJargon } from '../test/jargonBan';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockAuth = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn(),
  getAgreementsForPassenger: vi.fn(),
  leavePassenger: vi.fn(),
  terminateAgreement: vi.fn(),
  rejectAgreementTermination: vi.fn(),
  listAdendaHistorico: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/offlineQueue', () => ({
  listPending: vi.fn().mockResolvedValue([]),
  drainQueue: vi.fn().mockResolvedValue({ processed: 0, remaining: 0, conflicts: [] }),
}));

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: vi.fn(() => ({ isOnline: true, isOffline: false })),
}));

vi.mock('../services/PaymentService', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listPagamentosByAcordo: vi.fn(),
    getPagamentoForPassageiro: vi.fn(),
    getAcordoContactos: vi.fn(),
    getObrigacaoPagamentoPassageiro: vi.fn(),
    listAnulacaoMotivoLugarAcordos: vi.fn().mockResolvedValue([]),
    listPagamentosPendentesMotoristaAcordo: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../services/RatingService', () => ({
  listMinhasAvaliacoesAcordo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

import {
  getAgreementsForDriver,
  getAgreementsForPassenger,
  leavePassenger,
  terminateAgreement,
  rejectAgreementTermination,
  listAdendaHistorico,
} from '../services/AgreementService';
import { resetOverlayStackForTests } from '../utils/overlayStack';
import { notifyMarketplaceHubRefresh } from '../utils/marketplaceHubRefresh';
import { ACORDO_DETALHE_POLL_MS } from '../hooks/useAcordoDetalheLiveRefresh';
import { copyCancelamentoPendente } from '../utils/rescisaoDisplay';
import { listPending } from '../services/offlineQueue';
import {
  listPagamentosByAcordo,
  getPagamentoForPassageiro,
  getAcordoContactos,
  getMesReferenciaAtual,
  getObrigacaoPagamentoPassageiro,
  listAnulacaoMotivoLugarAcordos,
  listPagamentosPendentesMotoristaAcordo,
} from '../services/PaymentService';

/** @param {boolean} [emCustodia] */
function setupPagamentosDefault(emCustodia = true) {
  const estado = emCustodia ? 'em_custodia' : 'pendente_pagamento';
  const mesReferencia = getMesReferenciaAtual();
  const pagamentos = ['pax-1', 'pax-2', 'pax-viewer', 'pax-3'].map((pid) => ({
    id: `pag-${pid}`,
    passenger_id: pid,
    estado,
    valor_kz: 40000,
    valor_payout_liquido_kz: 36000,
    mes_referencia: mesReferencia,
  }));
  listPagamentosByAcordo.mockResolvedValue(pagamentos);
  getAcordoContactos.mockResolvedValue({ bloqueado: false, passageiros: [], motorista: null });
  getPagamentoForPassageiro.mockImplementation(async (_acordoId, passengerId, mesRef) => (
    pagamentos.find(
      (p) => p.passenger_id === passengerId
        && (!mesRef || String(p.mes_referencia).slice(0, 10) === String(mesRef).slice(0, 10)),
    ) ?? null
  ));
}

/**
 * @param {object} [acordo]
 * @param {string} [viewerId]
 * @param {boolean} [emCustodia]
 * @param {string} [estadoPagamentoOverride]
 */
function mockPagamentosGate(acordo, viewerId, emCustodia = true, estadoPagamentoOverride) {
  const estado = estadoPagamentoOverride
    ?? (emCustodia ? 'em_custodia' : 'pendente_pagamento');
  const mesReferencia = getMesReferenciaAtual();
  const noAcordo = (acordo?.acordos_passageiros || []).filter((p) => {
    const e = String(p.estado || '').toLowerCase();
    return e === 'activo' || e === 'reservado';
  });
  const pagamentos = noAcordo.length > 0
    ? noAcordo.map((p) => ({
      id: `pag-${p.passenger_id}`,
      passenger_id: p.passenger_id,
      estado,
      valor_kz: p.quota_mensal_kz ?? acordo?.valor_mensal_por_passageiro_kz ?? 40000,
      valor_payout_liquido_kz: 36000,
      mes_referencia: mesReferencia,
    }))
    : [];
  listPagamentosByAcordo.mockResolvedValue(pagamentos);
  getAcordoContactos.mockResolvedValue({ bloqueado: false, passageiros: [], motorista: null });
  getPagamentoForPassageiro.mockImplementation(async (_acordoId, passengerId, mesRef) => (
    pagamentos.find(
      (p) => p.passenger_id === passengerId
        && (!mesRef || String(p.mes_referencia).slice(0, 10) === String(mesRef).slice(0, 10)),
    ) ?? null
  ));
  if (viewerId && emCustodia) {
    getPagamentoForPassageiro.mockResolvedValue(
      pagamentos.find((p) => p.passenger_id === viewerId) ?? null,
    );
  }

  getObrigacaoPagamentoPassageiro.mockImplementation(async (acordoPassageiroId) => {
    const linha = noAcordo.find((p) => p.id === acordoPassageiroId);
    if (!linha) {
      return { obrigacao: null, pagamento: null };
    }
    const pag = pagamentos.find((p) => p.passenger_id === linha.passenger_id) ?? null;
    const valor = pag?.valor_kz ?? linha.quota_mensal_kz ?? acordo?.valor_mensal_por_passageiro_kz ?? 40000;
    const valorEmDivida = emCustodia ? 0 : valor;
    return {
      obrigacao: {
        valor: valorEmDivida,
        valor_em_divida: valorEmDivida,
        quota: linha.quota_mensal_kz ?? valor,
      },
      pagamento: pag,
    };
  });
}

const acordoMotorista = {
  id: 'acordo-1',
  estado: 'activo',
  modo_preco: 'POR_PASSAGEIRO',
  n_passageiros_contrato: 3,
  valor_mensal_por_passageiro_kz: 40000,
  valor_mensal_total_kz: 120000,
  is_hidden_by_user: false,
  created_at: '2026-06-12T10:00:00Z',
  ofertas_capacidade: {
    origin_name: 'Talatona',
    destination_name: 'Mutual',
    departure_time: '07:15',
  },
  acordos_passageiros: [
    {
      id: 'ap-1',
      passenger_id: 'pax-1',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'Ana Costa' },
    },
    {
      id: 'ap-2',
      passenger_id: 'pax-2',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'João Pedro' },
    },
    {
      id: 'ap-3',
      passenger_id: 'pax-3',
      estado: 'saiu',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'Maria Silva' },
    },
  ],
};

const acordoPassageiro = {
  id: 'acordo-pax',
  estado: 'activo',
  modo_preco: 'POR_PASSAGEIRO',
  n_passageiros_contrato: 3,
  valor_mensal_por_passageiro_kz: 40000,
  valor_mensal_total_kz: 120000,
  is_hidden_by_user: false,
  ofertas_capacidade: {
    origin_name: 'Talatona',
    destination_name: 'Mutual',
    departure_time: '07:15',
  },
  acordos_passageiros: [
    {
      id: 'ap-1',
      passenger_id: 'pax-viewer',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'Tu Mesmo' },
    },
    {
      id: 'ap-2',
      passenger_id: 'pax-2',
      estado: 'activo',
      quota_mensal_kz: 40000,
      perfis: { nome_completo: 'João Pedro' },
    },
  ],
};

function renderPage(initialEntries = ['/acordos']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

/** @param {HTMLElement} dialog */
function openAcordoKebab(dialog) {
  fireEvent.click(within(dialog).getByRole('button', { name: /Mais acções do acordo/i }));
}

/** @param {RegExp | string} name */
async function clickAcordoKebabItem(name) {
  fireEvent.click(await screen.findByRole('menuitem', { name }));
}

describe('MyAgreements — marketplace 1:N', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordoMotorista]);
    getAgreementsForPassenger.mockResolvedValue([]);
    listPending.mockResolvedValue([]);
    setupPagamentosDefault();
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      obrigacao: { valor: 40000, valor_em_divida: 40000, quota: 40000 },
      pagamento: {
        id: 'pag-pax-viewer',
        passenger_id: 'pax-viewer',
        valor_kz: 40000,
        estado: 'em_custodia',
        mes_referencia: getMesReferenciaAtual(),
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetOverlayStackForTests();
  });

  it('lista acordos activos com copy humana', async () => {
    renderPage();

    expect(await screen.findByText('Acordos')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
      expect(screen.getByText(/Kz \/ pessoa/i)).toBeInTheDocument();
    });
  });

  it('motorista: snapshot N=1 prefere passageiro activo/reservado sobre linha saiu', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        n_passageiros_contrato: 1,
        acordos_passageiros: [
          {
            id: 'ap-saiu',
            passenger_id: 'pax-saiu',
            estado: 'saiu',
            quota_mensal_kz: 20000,
            perfis: { nome_completo: 'Maria Silva' },
          },
          {
            id: 'ap-activo',
            passenger_id: 'pax-activo',
            estado: 'activo',
            quota_mensal_kz: 20000,
            perfis: { nome_completo: 'João Pedro' },
          },
        ],
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /João/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const snapshot = within(dialog).getByTestId('acordo-contrato-snapshot');
    expect(within(snapshot).getByText('João')).toBeInTheDocument();
    expect(within(snapshot).queryByText('Maria')).not.toBeInTheDocument();
    expect(within(snapshot).queryByText('Individual')).not.toBeInTheDocument();
  });

  it('actualiza lista quando hubRefresh notifica após aceite', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger
      .mockResolvedValueOnce([])
      .mockResolvedValue([acordoPassageiro]);

    renderPage();

    await waitFor(() => {
      expect(getAgreementsForPassenger).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/Grupo · 3 pessoas/i)).not.toBeInTheDocument();

    notifyMarketplaceHubRefresh();

    await waitFor(() => {
      expect(getAgreementsForPassenger).toHaveBeenCalledTimes(2);
      expect(screen.getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
    });
  });

  it('motorista: detalhe N=1 mostra primeiro nome em Pessoas no acordo', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        n_passageiros_contrato: 1,
        acordos_passageiros: [
          {
            id: 'ap-solo',
            passenger_id: 'pax-1',
            estado: 'activo',
            quota_mensal_kz: 20000,
            perfis: { nome_completo: 'Ana Costa' },
          },
        ],
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Ana/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const snapshot = within(dialog).getByTestId('acordo-contrato-snapshot');
    expect(within(snapshot).getByText('Ana')).toBeInTheDocument();
    expect(within(snapshot).queryByText('Individual')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('passenger-row-pax-1')).toHaveTextContent('Ana');
    expect(within(dialog).queryByText('Ana Costa')).not.toBeInTheDocument();
  });

  it('motorista: acordo individual na lista mostra primeiro nome do passageiro', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        n_passageiros_contrato: 1,
        acordos_passageiros: [
          {
            id: 'ap-solo',
            passenger_id: 'pax-1',
            estado: 'activo',
            quota_mensal_kz: 20000,
            perfis: { nome_completo: 'Ana Costa' },
          },
        ],
      },
    ]);

    renderPage();

    expect(await screen.findByText('Ana')).toBeInTheDocument();
    expect(screen.queryByText('Individual')).not.toBeInTheDocument();
  });

  it('acordo com oferta flexível não mostra placeholders Origem/Destino', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        ofertas_capacidade: {
          flexibilidade_rota: true,
          departure_time: '07:15',
          origin_name: null,
          destination_name: null,
        },
      },
    ]);

    renderPage();

    expect(await screen.findByText('Oferta flexível')).toBeInTheDocument();
    expect(screen.queryByText(/^Origem$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Destino$/)).not.toBeInTheDocument();
  });

  it('detalhe de acordo flexível não usa rótulos Partida/Chegada (sem OD fictícia)', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        ofertas_capacidade: {
          flexibilidade_rota: true,
          departure_time: '07:15',
          origin_name: null,
          destination_name: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Oferta flexível/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByText(/Oferta flexível — sem origem\/destino fixos/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/^Partida$/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/^Chegada$/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/^Origem$/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/^Destino$/)).not.toBeInTheDocument();
  });

  it('motorista no detalhe vê N linhas com nome, quota Kz e estado humano', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('acordo-contrato-snapshot')).toBeInTheDocument();
    expect(within(dialog).getByText(/Contrato acordado/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/O valor fica congelado durante este acordo/i),
    ).toBeInTheDocument();
    const snapshot = within(dialog).getByTestId('acordo-contrato-snapshot');
    expect(within(snapshot).getAllByText(/Por passageiro/i).length).toBeGreaterThanOrEqual(1);
    expect(within(snapshot).getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Passageiros · 3/i)).toBeInTheDocument();

    expect(within(dialog).getByText('Ana')).toBeInTheDocument();
    expect(within(dialog).getByText('João')).toBeInTheDocument();
    expect(within(dialog).getByText('Maria')).toBeInTheDocument();
    expect(within(dialog).queryByText('Ana Costa')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('João Pedro')).not.toBeInTheDocument();

    expect(within(dialog).getAllByText(/40\.?\s?000 Kz/i).length).toBeGreaterThanOrEqual(3);
    expect(within(dialog).getAllByText(/Confirmad/i).length).toBeGreaterThanOrEqual(2);
    expect(within(dialog).getByText(/^Saiu$/i)).toBeInTheDocument();

    expect(within(dialog).queryByText(/N_contrato/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/POR_PASSAGEIRO/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/passenger_id/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/pax-1/i)).not.toBeInTheDocument();
  });

  it('passageiro vê a sua quota em destaque e badge de preço congelado', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    mockPagamentosGate(acordoPassageiro, 'pax-viewer');

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('acordo-contrato-snapshot')).toBeInTheDocument();
    expect(within(dialog).getByText(/Contrato acordado/i)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/O valor fica congelado durante este acordo/i),
    ).toBeInTheDocument();
    expect(within(dialog).getByTestId('contrato-quota-destaque')).toBeInTheDocument();

    const ownRow = within(dialog).getByTestId('passenger-row-pax-viewer');
    expect(ownRow).toHaveAttribute('data-highlighted', 'true');
    expect(within(ownRow).getByText('Tu Mesmo')).toBeInTheDocument();
    expect(within(ownRow).getByText(/40\.?\s?000 Kz/i)).toBeInTheDocument();

    expect(within(dialog).getByRole('button', { name: /Sair só eu/i })).toBeInTheDocument();
    openAcordoKebab(dialog);
    expect(screen.getByRole('menuitem', { name: /Encerrar acordo/i })).toBeInTheDocument();
  });

  it('detalhe mostra Fechar no topo', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('acordo-detalhe-fechar')).toBeInTheDocument();
  });

  it('CTA Registar falta navega para /faltas/:id', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    await clickAcordoKebabItem(/Registar falta/i);

    expect(mockNavigate).toHaveBeenCalledWith('/faltas/acordo-1');
  });

  it('acordo activo: mostra Registar falta no kebab', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    expect(screen.getByRole('menuitem', { name: /Registar falta/i })).toBeInTheDocument();
  });

  it('sem pagamento em custódia: mostra aviso em vez de CTA Registar falta', async () => {
    mockPagamentosGate(acordoMotorista, undefined, false);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    expect(screen.queryByRole('menuitem', { name: /Registar falta/i })).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('faltas-gate-pagamento')).toBeInTheDocument();
  });

  it('acordo não activo: não mostra CTA Registar falta', async () => {
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoMotorista, id: 'acordo-cancelado', estado: 'cancelado' },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Mais acções do acordo/i })).not.toBeInTheDocument();
  });

  it('acordo cancelado: não chama getAcordoContactos mas carrega pagamentos', async () => {
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoMotorista, id: 'acordo-cancelado', estado: 'cancelado' },
    ]);

    renderPage();
    getAcordoContactos.mockClear();
    listPagamentosByAcordo.mockClear();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await waitFor(() => {
      expect(listPagamentosByAcordo).toHaveBeenCalledWith('acordo-cancelado');
      expect(getAcordoContactos).not.toHaveBeenCalled();
    });
    expect(screen.queryByTestId('contactos-loading')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contactos-bloqueados')).not.toBeInTheDocument();
    expect(screen.queryByTestId('contactos-desbloqueados')).not.toBeInTheDocument();
  });

  it('acordo cancelado com passageiro saiu liquidado: motorista vê banner de avaliação', async () => {
    const settledAt = new Date(Date.now() - 2 * 86400000).toISOString();

    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        id: 'acordo-cancelado',
        estado: 'cancelado',
        acordos_passageiros: [
          {
            id: 'ap-1',
            passenger_id: 'pax-1',
            estado: 'saiu',
            quota_mensal_kz: 40000,
            perfis: { nome_completo: 'Ana Costa' },
          },
        ],
      },
    ]);
    listPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pag-1',
        acordo_passageiro_id: 'ap-1',
        passenger_id: 'pax-1',
        estado: 'liquidado',
        validado_em: settledAt,
        liquidado_em: settledAt,
        mes_referencia: '2026-09-01',
      },
    ]);

    renderPage();
    getAcordoContactos.mockClear();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await waitFor(() => {
      expect(listPagamentosByAcordo).toHaveBeenCalled();
      expect(getAcordoContactos).not.toHaveBeenCalled();
    });
    expect(await within(dialog).findByTestId('acordo-rating-mot-banner')).toBeInTheDocument();
  });

  describe('estado lugar — saiu vs expirado', () => {
    it('passageiro: chip «Saiu» no cartão e no cabeçalho do sheet', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([
        {
          ...acordoPassageiro,
          estado: 'activo',
          acordos_passageiros: [
            {
              id: 'ap-viewer',
              passenger_id: 'pax-viewer',
              estado: 'saiu',
              quota_mensal_kz: 40000,
              perfis: { nome_completo: 'Tu Mesmo' },
            },
          ],
        },
      ]);
      mockPagamentosGate(
        {
          acordos_passageiros: [{ id: 'ap-viewer', passenger_id: 'pax-viewer', estado: 'saiu' }],
        },
        'pax-viewer',
        false,
        'anulado',
      );

      renderPage();

      const chipCartao = await screen.findByTestId('acordo-lugar-saiu-chip-acordo-pax');
      expect(chipCartao).toHaveTextContent('Saiu');
      expect(chipCartao).not.toHaveTextContent('Expirado');
      expect(chipCartao).not.toHaveTextContent('Activo');

      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      const chipSheet = within(dialog).getByTestId('acordo-lugar-saiu-chip-acordo-pax');
      expect(chipSheet).toHaveTextContent('Saiu');
    });

    it('passageiro: chip «Expirado» quando reserva TTL (estado expirado)', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([
        {
          ...acordoPassageiro,
          acordos_passageiros: [
            {
              id: 'ap-viewer',
              passenger_id: 'pax-viewer',
              estado: 'expirado',
              quota_mensal_kz: 40000,
              perfis: { nome_completo: 'Tu Mesmo' },
            },
          ],
        },
      ]);
      getObrigacaoPagamentoPassageiro.mockResolvedValue({
        obrigacao: { valor_em_divida: 0 },
        pagamento: {
          estado: 'anulado',
          anulacao_motivo: 'Prazo de reserva expirado',
        },
      });

      renderPage();

      const chipCartao = await screen.findByTestId('acordo-lugar-expirado-chip-acordo-pax');
      expect(chipCartao).toHaveTextContent('Expirado');
      expect(chipCartao).not.toHaveTextContent('Saiu');
    });

    it('motorista: chips «Saiu» e «Expirado» na lista de passageiros', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      listAnulacaoMotivoLugarAcordos.mockResolvedValue([
        {
          acordo_id: 'acordo-1',
          passenger_id: 'pax-exp',
          anulacao_motivo: 'Prazo de reserva expirado',
          pagamento_estado: 'anulado',
        },
      ]);
      getAgreementsForDriver.mockResolvedValue([
        {
          ...acordoMotorista,
          acordos_passageiros: [
            {
              id: 'ap-saiu',
              passenger_id: 'pax-saiu',
              estado: 'saiu',
              quota_mensal_kz: 40000,
              perfis: { nome_completo: 'Maria Saiu' },
            },
            {
              id: 'ap-exp',
              passenger_id: 'pax-exp',
              estado: 'expirado',
              quota_mensal_kz: 40000,
              perfis: { nome_completo: 'Pedro Expirado' },
            },
          ],
        },
      ]);
      setupPagamentosDefault(false);

      renderPage();

      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

      expect(within(dialog).getByTestId('passageiro-estado-chip-pax-saiu')).toHaveTextContent('Saiu');
      expect(within(dialog).getByTestId('passageiro-estado-chip-pax-exp')).toHaveTextContent('Expirado');
    });
  });

  it('passageiro que saiu: não mostra CTA Registar falta no detalhe do acordo inactivo', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoPassageiro,
        id: 'acordo-saiu',
        estado: 'cancelado',
        acordos_passageiros: [
          {
            id: 'ap-1',
            passenger_id: 'pax-viewer',
            estado: 'saiu',
            quota_mensal_kz: 40000,
            perfis: { nome_completo: 'Tu Mesmo' },
          },
        ],
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Mais acções do acordo/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Sair só eu/i })).not.toBeInTheDocument();
  });

  it('passageiro activo: Encerrar acordo abre modalidades A/B/C', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    await clickAcordoKebabItem(/Encerrar acordo/i);

    const picker = await screen.findByTestId('terminate-modality-picker');
    expect(within(picker).getByText(/^Acordo amigável$/i)).toBeInTheDocument();
    expect(within(picker).getByText(/^Aviso prévio$/i)).toBeInTheDocument();
    expect(within(picker).getByText(/^Justa causa imediata$/i)).toBeInTheDocument();
  });

  it('passageiro activo: Sair só eu chama leavePassenger e avisa quota', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    mockPagamentosGate(acordoPassageiro, 'pax-viewer');
    leavePassenger.mockResolvedValue({ ok: true });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    expect(
      screen.getByText(/A tua quota deste mês não é reembolsada/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });
    expect(
      await screen.findByText(/Saíste do acordo\. A quota do mês mantém-se/i),
    ).toBeInTheDocument();
  });

  it('passageiro reservado: modal de saída neutro enquanto pagamento carrega', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    listPagamentosByAcordo.mockResolvedValue([]);
    let resolveObrigacao;
    getObrigacaoPagamentoPassageiro.mockImplementation(
      () => new Promise((resolve) => {
        resolveObrigacao = resolve;
      }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    expect(screen.getByText(/A confirmar o estado do pagamento/i)).toBeInTheDocument();
    expect(screen.queryByText(/Não tens nada a pagar neste acordo/i)).not.toBeInTheDocument();

    resolveObrigacao({ obrigacao: { valor_em_divida: 0 }, pagamento: null });
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('passageiro reservado: Sair só eu avisa cancelamento de pagamento', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false);
    leavePassenger.mockResolvedValue({ ok: true });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    expect(
      screen.getByText(/pagamento pendente será cancelado/i),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });
    expect(
      await screen.findByText(/O pagamento pendente foi cancelado/i),
    ).toBeInTheDocument();
  });

  it('passageiro reservado: chip âmbar, glossário, contagens e CTA pagamento', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
        {
          id: 'ap-2',
          passenger_id: 'pax-2',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Pedro' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false);

    renderPage();

    const cardChip = await screen.findByTestId('acordo-lugar-chip-acordo-pax');
    expect(cardChip).toHaveTextContent('Reservado');
    expect(cardChip.className).toMatch(/amber/);

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('lugar-reservado-banner')).toHaveTextContent(
      /Lugar reservado — aguarda pagamento/i,
    );
    expect(within(dialog).getByTestId('lugar-reservado-pagamento-cta')).toBeInTheDocument();
    expect(within(dialog).getByTestId('passageiros-contagem')).toHaveTextContent(
      'Confirmados 1 · Reservados 1',
    );
    expect(within(dialog).getByTestId('estados-lugar-glossario')).toHaveTextContent(/Reservado/i);
    expect(within(dialog).getByTestId('estados-lugar-glossario')).toHaveTextContent(/Confirmado/i);
    expect(within(dialog).getByTestId('estados-lugar-glossario')).toHaveTextContent(/Em custódia/i);
    expect(within(dialog).getByTestId('acordo-pagamento-panel')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /Sair só eu/i })).toBeInTheDocument();
    expect(within(dialog).queryByTestId('mudar-preco-proximo-mes-cta')).not.toBeInTheDocument();
    openAcordoKebab(dialog);
    expect(screen.queryByRole('menuitem', { name: /Registar falta/i })).not.toBeInTheDocument();
    expectNoUserFacingJargon(dialog.textContent);
  });

  it('S1-B: reservado com obrigação valor 0 oculta banner 72h e CTA pagamento', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false);
    vi.mocked(getObrigacaoPagamentoPassageiro).mockResolvedValue({
      obrigacao: { valor: 0, valor_em_divida: 0, quota: 40000 },
      pagamento: {
        id: 'pag-pax-viewer',
        valor_kz: 0,
        estado: 'pendente_pagamento',
      },
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByTestId('lugar-reservado-banner')).not.toBeInTheDocument();
    expect(within(dialog).queryByTestId('lugar-reservado-pagamento-cta')).not.toBeInTheDocument();
  });

  it('passageiro reservado com comprovativo_enviado: não vê hint de próximo passo', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false, 'comprovativo_enviado');
    getAcordoContactos.mockResolvedValue({
      bloqueado: true,
      motivo: 'Disponíveis após pagamento em custódia.',
      motorista: { nome_completo: 'Motorista Teste', telefone: null },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByTestId('contactos-proximo-passo')).not.toBeInTheDocument();
  });

  it('passageiro reservado com contactos bloqueados: vê próximo passo do comprovativo', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false);
    getAcordoContactos.mockResolvedValue({
      bloqueado: true,
      motivo: 'Disponíveis após pagamento em custódia.',
      motorista: { nome_completo: 'Motorista Teste', telefone: null },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('contactos-proximo-passo')).toHaveTextContent(
      /envia o comprovativo de transferência/i,
    );
    expect(within(dialog).queryByTestId('contactos-aguardar-pagamento')).not.toBeInTheDocument();
  });

  it('motorista com passageiro reservado: contactos bloqueados mostram aguardar pagamento', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    const acordoMix = {
      ...acordoMotorista,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Ana Costa' },
        },
        {
          id: 'ap-2',
          passenger_id: 'pax-2',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Pedro' },
        },
      ],
    };
    getAgreementsForDriver.mockResolvedValue([acordoMix]);
    mockPagamentosGate(acordoMix, undefined, false);
    getAcordoContactos.mockResolvedValue({
      bloqueado: true,
      motivo: 'Disponíveis após pagamento em custódia.',
      motorista: { nome_completo: 'Motorista Teste', telefone: null },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByTestId('contactos-proximo-passo')).not.toBeInTheDocument();
    expect(within(dialog).getByTestId('contactos-aguardar-pagamento')).toHaveTextContent(
      /A aguardar o pagamento de João Pedro\./,
    );
  });

  it('passageiro reservado: CTA pagamento faz scroll ao painel', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false);

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('lugar-reservado-pagamento-cta'));

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('deep-link focus=pagamento abre acordo e foca painel de pagamento', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    const acordoReservado = {
      ...acordoPassageiro,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-viewer',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Tu Mesmo' },
        },
      ],
    };
    getAgreementsForPassenger.mockResolvedValue([acordoReservado]);
    mockPagamentosGate(acordoReservado, 'pax-viewer', false);

    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderPage(['/acordos?openAcordoId=acordo-pax&focus=pagamento']);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalled();
    });
    expect(screen.getByTestId('acordo-pagamento-section')).toBeInTheDocument();
  });

  it('motorista vê contagens Confirmados · Reservados e chips por passageiro', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    const acordoMix = {
      ...acordoMotorista,
      acordos_passageiros: [
        {
          id: 'ap-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'Ana Costa' },
        },
        {
          id: 'ap-2',
          passenger_id: 'pax-2',
          estado: 'reservado',
          quota_mensal_kz: 40000,
          perfis: { nome_completo: 'João Pedro' },
        },
      ],
    };
    getAgreementsForDriver.mockResolvedValue([acordoMix]);
    mockPagamentosGate(acordoMix, undefined, true);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('passageiros-contagem')).toHaveTextContent(
      'Confirmados 1 · Reservados 1',
    );
    expect(within(dialog).getByTestId('passageiro-estado-chip-pax-2')).toHaveTextContent('Reservado');
    expect(within(dialog).getByTestId('passageiro-estado-chip-pax-2').className).toMatch(/amber/);
    expect(within(dialog).getByTestId('passageiro-estado-chip-pax-1')).toHaveTextContent('Confirmado');
  });

  it('leave offlineQueued: mostra Saída Pendente e desactiva Sair só eu', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    leavePassenger.mockResolvedValue({
      offlineQueued: true,
      id: 'acordo-pax',
      idempotency_key: 'idem-leave-1',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });

    expect(await screen.findByText(/Saída Pendente/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByRole('button', { name: /Sair só eu/i })).toBeDisabled();
  });

  it('passageiro escolhe aviso prévio e chama terminateAgreement', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    terminateAgreement.mockResolvedValue({ id: 'acordo-pax', estado: 'cancelamento_pendente' });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    await clickAcordoKebabItem(/Encerrar acordo/i);

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Aviso prévio/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalledWith(
        'acordo-pax',
        { modo: 'aviso_previo' },
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
    });
    expect(
      await screen.findByText(/Rescisão agendada|mantém-se activo até ao fim do mês/i),
    ).toBeInTheDocument();
  });

  it('terminate offlineQueued: mostra feedback de sincronização', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    terminateAgreement.mockResolvedValue({
      offlineQueued: true,
      id: 'acordo-pax',
      idempotency_key: 'idem-term-1',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    await clickAcordoKebabItem(/Encerrar acordo/i);

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));

    const vigencia = await screen.findByTestId('terminate-vigencia-picker');
    fireEvent.click(within(vigencia).getByRole('button', { name: /Agora — ajuste proporcional/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalledWith(
        'acordo-pax',
        { modo: 'consensual', vigencia: 'imediato' },
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
    });

    const feedback = screen.getByTestId('agreements-feedback');
    expect(feedback).toHaveAttribute('data-variant', 'success');
    expect(feedback).toHaveTextContent(/guardada|Sincronizamos/i);
  });

  it('consensual fim deste mês envia vigencia fim_ciclo', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    terminateAgreement.mockResolvedValue({
      id: 'acordo-pax',
      estado: 'activo',
      rescisao_modo: 'consensual',
      rescisao_vigencia: 'fim_ciclo',
    });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    await clickAcordoKebabItem(/Encerrar acordo/i);

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));
    const vigencia = await screen.findByTestId('terminate-vigencia-picker');
    fireEvent.click(within(vigencia).getByRole('button', { name: /Fim deste mês/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalledWith(
        'acordo-pax',
        { modo: 'consensual', vigencia: 'fim_ciclo' },
        expect.objectContaining({
          idempotencyKey: expect.stringMatching(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
          ),
        }),
      );
    });
  });

  it('cartão activo destaca a quota congelada com tipografia forte', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    renderPage();

    const card = await screen.findByRole('button', { name: /Talatona/i });
    const quota = within(card).getByTestId('card-quota-congelada');
    expect(quota).toHaveTextContent(/40[\s.]?000/);
    expect(quota.className).toMatch(/text-lg/);
    expect(quota.className).toMatch(/font-bold/);
    expect(quota.className).toMatch(/text-primary/);
  });

  it('durante terminateBusy: botões de confirmação ficam desactivados', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

    let resolveTerminate;
    terminateAgreement.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTerminate = resolve;
        }),
    );

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    await clickAcordoKebabItem(/Encerrar acordo/i);

    const picker = await screen.findByTestId('terminate-modality-picker');
    fireEvent.click(within(picker).getByRole('button', { name: /Aviso prévio/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

    await waitFor(() => {
      expect(terminateAgreement).toHaveBeenCalled();
    });

    const confirmBtn = screen.getByRole('button', { name: /^Encerrar acordo$/i });
    const cancelBtn = screen.getByRole('button', { name: /^Cancelar$/i });
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();

    resolveTerminate({ id: 'acordo-pax', estado: 'cancelamento_pendente' });
    await waitFor(() => {
      expect(screen.queryByTestId('terminate-modality-picker')).not.toBeInTheDocument();
    });
  });

  it('motorista activo vê Encerrar acordo (sem Sair só eu)', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    openAcordoKebab(dialog);
    expect(screen.getByRole('menuitem', { name: /Encerrar acordo/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Sair só eu/i })).not.toBeInTheDocument();
  });

  it('motorista em acordo activo vê pagamentos do mês (RPC estreita, read-only)', async () => {
    listPagamentosPendentesMotoristaAcordo.mockResolvedValue([
      {
        pagamento_id: 'pg-s4',
        passenger_id: 'pax-1',
        passenger_nome: 'Ana Costa',
        estado: 'comprovativo_enviado',
        valor: 0,
        valor_em_divida: 0,
        valor_comprovativo: 40000,
        prazo: '2026-10-18T23:59:59.000Z',
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await waitFor(() => {
      expect(listPagamentosPendentesMotoristaAcordo).toHaveBeenCalledWith('acordo-1');
    });
    expect(within(dialog).getByTestId('motorista-pagamentos-titulo')).toHaveTextContent(
      'Pagamentos do mês',
    );
    expect(within(dialog).getByTestId('motorista-pagamento-comprovativo-pax-1')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Enviar comprovativo/i })).not.toBeInTheDocument();
  });

  it('motorista não vê Sair só eu', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByRole('button', { name: /Sair só eu/i })).not.toBeInTheDocument();
  });

  describe('encerramento consensual', () => {
    afterEach(() => {
      resetOverlayStackForTests();
    });

    const acordoComPedidoMotorista = {
      ...acordoPassageiro,
      rescisao_modo: 'consensual',
      rescisao_solicitada_por: 'driver-1',
      rescisao_vigencia: 'imediato',
    };

    it('contraparte vê Confirmar e Recusar; confirmar chama terminateAgreement consensual', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      const encerrado = {
        ...acordoComPedidoMotorista,
        estado: 'cancelado',
        rescisao_modo: null,
        rescisao_solicitada_por: null,
        rescisao_vigencia: null,
      };
      getAgreementsForPassenger
        .mockResolvedValueOnce([acordoComPedidoMotorista])
        .mockResolvedValue([encerrado]);
      terminateAgreement.mockResolvedValue({
        id: 'acordo-pax',
        estado: 'cancelado',
      });

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(within(dialog).getByTestId('rescisao-consensual-pendente')).toBeInTheDocument();
      expect(within(dialog).getByTestId('rescisao-confirmar-cta')).toHaveTextContent(
        /Confirmar encerramento/i,
      );

      fireEvent.click(within(dialog).getByTestId('rescisao-confirmar-cta'));

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
        expect(terminateAgreement).toHaveBeenCalledWith(
          'acordo-pax',
          { modo: 'consensual', vigencia: 'imediato' },
          expect.objectContaining({
            idempotencyKey: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            ),
          }),
        );
      });

      await waitFor(() => {
        expect(within(dialog).queryByTestId('rescisao-consensual-pendente')).not.toBeInTheDocument();
        expect(within(dialog).getByText(/^cancelado$/i)).toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    it('contraparte recusa pedido consensual via rejectAgreementTermination', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);
      rejectAgreementTermination.mockResolvedValue({
        id: 'acordo-pax',
        estado: 'activo',
        rescisao_modo: null,
      });

      renderPage(['/acordos?openAcordoId=acordo-pax']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      fireEvent.click(within(dialog).getByTestId('rescisao-recusar-cta'));

      await waitFor(() => {
        expect(rejectAgreementTermination).toHaveBeenCalledTimes(1);
        expect(rejectAgreementTermination).toHaveBeenCalledWith(
          'acordo-pax',
          expect.objectContaining({
            idempotencyKey: expect.stringMatching(
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
            ),
          }),
        );
      });
      expect(await screen.findByText(/Pedido de encerramento recusado/i)).toBeInTheDocument();
    });

    it('requerente vê pedido enviado e não tem Encerrar acordo no kebab', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      getAgreementsForDriver.mockResolvedValue([
        {
          ...acordoMotorista,
          rescisao_modo: 'consensual',
          rescisao_solicitada_por: 'driver-1',
          rescisao_vigencia: 'fim_ciclo',
        },
      ]);

      renderPage(['/acordos?openAcordoId=acordo-1']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(within(dialog).getByTestId('rescisao-consensual-enviada')).toHaveTextContent(
        /Pedido enviado, à espera da outra parte/i,
      );
      expect(
        within(dialog).queryByRole('menuitem', { name: /Encerrar acordo/i }),
      ).not.toBeInTheDocument();
      const kebabTrigger = within(dialog).queryByRole('button', { name: /Mais acções do acordo/i });
      if (kebabTrigger) {
        openAcordoKebab(dialog);
        expect(screen.queryByRole('menuitem', { name: /Encerrar acordo/i })).not.toBeInTheDocument();
      }
    });

    it('após pedir consensual mantém detalhe aberto com estado enviado', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      const acordoComPedidoEnviado = {
        ...acordoPassageiro,
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'pax-viewer',
        rescisao_vigencia: 'imediato',
      };
      getAgreementsForPassenger
        .mockResolvedValueOnce([acordoPassageiro])
        .mockResolvedValue([acordoComPedidoEnviado]);
      terminateAgreement.mockResolvedValue(acordoComPedidoEnviado);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      openAcordoKebab(dialog);
      await clickAcordoKebabItem(/Encerrar acordo/i);

      const picker = await screen.findByTestId('terminate-modality-picker');
      fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));
      const vigencia = await screen.findByTestId('terminate-vigencia-picker');
      fireEvent.click(within(vigencia).getByRole('button', { name: /Agora — ajuste proporcional/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
      });

      expect(await screen.findByTestId('rescisao-consensual-enviada')).toBeInTheDocument();
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    it('Escape no picker de modalidades fecha só o picker e mantém o detalhe', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      openAcordoKebab(dialog);
      await clickAcordoKebabItem(/Encerrar acordo/i);

      expect(await screen.findByTestId('terminate-modality-picker')).toBeInTheDocument();
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByTestId('terminate-modality-picker')).not.toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    it('cliques rápidos no Confirmar só disparam um pedido', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      const encerrado = {
        ...acordoComPedidoMotorista,
        estado: 'cancelado',
        rescisao_modo: null,
        rescisao_solicitada_por: null,
        rescisao_vigencia: null,
      };
      getAgreementsForPassenger
        .mockResolvedValueOnce([acordoComPedidoMotorista])
        .mockResolvedValue([encerrado]);

      let resolveTerminate;
      terminateAgreement.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveTerminate = resolve;
          }),
      );

      renderPage(['/acordos?openAcordoId=acordo-pax']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      const confirmar = within(dialog).getByTestId('rescisao-confirmar-cta');
      fireEvent.click(confirmar);
      fireEvent.click(confirmar);

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
      });
      expect(confirmar).toBeDisabled();

      resolveTerminate({ id: 'acordo-pax', estado: 'cancelado' });
      await waitFor(() => {
        expect(
          screen.queryByTestId('rescisao-consensual-pendente'),
        ).not.toBeInTheDocument();
      });
    });

    it('focus=rescisao com pedido pendente: um scroll, remove focus da URL e refresh não repete scroll', async () => {
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(within(dialog).getByTestId('rescisao-consensual-pendente')).toBeInTheDocument();
      await waitFor(() => {
        expect(scrollSpy).toHaveBeenCalledTimes(1);
      });
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ search: '?openAcordoId=acordo-pax' }),
        expect.objectContaining({ replace: true }),
      );

      const callsBefore = getAgreementsForPassenger.mock.calls.length;
      notifyMarketplaceHubRefresh();
      notifyMarketplaceHubRefresh();
      await waitFor(() => {
        expect(getAgreementsForPassenger.mock.calls.length).toBeGreaterThan(callsBefore);
      });
      expect(scrollSpy).toHaveBeenCalledTimes(1);

      fireEvent.click(within(dialog).getByTestId('acordo-detalhe-fechar'));
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(scrollSpy).toHaveBeenCalledTimes(1);

      scrollSpy.mockRestore();
    });

    it('focus=rescisao com pedido já respondido: consome focus sem scroll', async () => {
      const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([
        {
          ...acordoComPedidoMotorista,
          estado: 'cancelamento_pendente',
          rescisao_solicitada_por: null,
          rescisao_effective_on: '2026-11-01',
        },
      ]);

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          expect.objectContaining({ search: '?openAcordoId=acordo-pax' }),
          expect.objectContaining({ replace: true }),
        );
      });
      expect(scrollSpy).not.toHaveBeenCalled();

      scrollSpy.mockRestore();
    });

    it('cancelamento_pendente: sem ticks de polling live refresh', async () => {
      getAgreementsForDriver.mockResolvedValue([
        {
          ...acordoMotorista,
          estado: 'cancelamento_pendente',
          rescisao_effective_on: '2026-11-01',
        },
      ]);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

      const baseline = getAgreementsForDriver.mock.calls.length;

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, ACORDO_DETALHE_POLL_MS + 150);
        });
      });

      expect(getAgreementsForDriver.mock.calls.length).toBe(baseline);
    });

    it('openAcordoId na URL reabre o sheet após remount', async () => {
      getAgreementsForDriver.mockResolvedValue([acordoMotorista]);

      const first = renderPage(['/acordos?openAcordoId=acordo-1']);
      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      first.unmount();

      renderPage(['/acordos?openAcordoId=acordo-1']);
      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    });

    it('refresh silencioso sobre load lento não deixa skeleton preso', async () => {
      let resolveLento;
      getAgreementsForDriver.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveLento = () => resolve([acordoMotorista]);
          }),
      );

      renderPage();
      expect(document.querySelector('.animate-pulse')).toBeInTheDocument();

      notifyMarketplaceHubRefresh();

      await act(async () => {
        resolveLento();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument();
      });
      expect(await screen.findByText('Acordos')).toBeInTheDocument();
    });

    it('ticks de lista não relêem pagamentos se id e estado do acordo iguais', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const aguardando = {
        ...acordoMotorista,
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
      };
      getAgreementsForDriver.mockResolvedValue([aguardando]);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

      await waitFor(() => {
        expect(listPagamentosByAcordo).toHaveBeenCalled();
      });
      const pagamentoCalls = listPagamentosByAcordo.mock.calls.length;

      notifyMarketplaceHubRefresh();
      await waitFor(() => {
        expect(getAgreementsForDriver.mock.calls.length).toBeGreaterThan(1);
      });
      expect(listPagamentosByAcordo.mock.calls.length).toBe(pagamentoCalls);
    });

    it('motorista: detalhe actualiza após confirmação da contraparte via polling (sem visibilitychange)', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const aguardandoConfirmacao = {
        ...acordoMotorista,
        id: 'acordo-1',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'fim_ciclo',
      };
      const aposConfirmacao = {
        ...aguardandoConfirmacao,
        estado: 'cancelamento_pendente',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: null,
        rescisao_effective_on: '2026-11-01',
      };
      getAgreementsForDriver
        .mockResolvedValueOnce([aguardandoConfirmacao])
        .mockResolvedValue([aguardandoConfirmacao]);

      const view = renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(within(dialog).getByTestId('rescisao-consensual-enviada')).toBeInTheDocument();

      getAgreementsForDriver.mockResolvedValue([aposConfirmacao]);

      await waitFor(
        () => {
          expect(within(dialog).getByTestId('cancelamento-pendente-banner')).toBeInTheDocument();
          expect(within(dialog).queryByTestId('rescisao-consensual-enviada')).not.toBeInTheDocument();
        },
        { timeout: ACORDO_DETALHE_POLL_MS + 500 },
      );
      expect(document.visibilityState).toBe('visible');

      view.unmount();
    });

    it('motorista: feedback «à espera da contraparte» actualiza na lista após confirmação', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const aposPedido = {
        ...acordoMotorista,
        id: 'acordo-1',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'fim_ciclo',
      };
      const aposConfirmacao = {
        ...aposPedido,
        estado: 'cancelamento_pendente',
        rescisao_solicitada_por: null,
        rescisao_effective_on: '2026-11-01',
      };
      getAgreementsForDriver
        .mockResolvedValueOnce([acordoMotorista])
        .mockResolvedValueOnce([aposPedido])
        .mockResolvedValue([aposPedido]);
      terminateAgreement.mockResolvedValue({
        id: 'acordo-1',
        estado: 'activo',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'fim_ciclo',
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      openAcordoKebab(dialog);
      await clickAcordoKebabItem(/Encerrar acordo/i);

      const picker = await screen.findByTestId('terminate-modality-picker');
      fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));
      const vigencia = await screen.findByTestId('terminate-vigencia-picker');
      fireEvent.click(within(vigencia).getByRole('button', { name: /Fim deste mês/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
      });

      const feedback = await screen.findByTestId('agreements-feedback');
      expect(feedback).toHaveTextContent(/A outra parte precisa de confirmar/i);

      getAgreementsForDriver.mockResolvedValue([aposConfirmacao]);

      await waitFor(
        () => {
          expect(screen.getByTestId('agreements-feedback')).not.toHaveTextContent(
            /A outra parte precisa de confirmar/i,
          );
        },
        { timeout: ACORDO_DETALHE_POLL_MS + 500 },
      );

      const copy = copyCancelamentoPendente('2026-11-01');
      expect(screen.getByTestId('agreements-feedback')).toHaveTextContent(copy.corpo);
    });

    it('motorista com 2 acordos: feedback de espera só actualiza quando o acordo pedido confirma', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const copyAcordoA = copyCancelamentoPendente('2026-10-01');
      const copyAcordoB = copyCancelamentoPendente('2026-12-01');

      const acordoA = {
        ...acordoMotorista,
        id: 'acordo-a',
        estado: 'cancelamento_pendente',
        rescisao_effective_on: '2026-10-01',
        ofertas_capacidade: {
          origin_name: 'Belas',
          destination_name: 'Centro',
          departure_time: '07:00',
        },
      };
      const acordoB = {
        ...acordoMotorista,
        id: 'acordo-b',
        estado: 'activo',
        ofertas_capacidade: {
          origin_name: 'Viana',
          destination_name: 'Aeroporto',
          departure_time: '08:00',
        },
      };
      const aposPedidoB = {
        ...acordoB,
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'fim_ciclo',
      };
      const aposConfirmacaoB = {
        ...aposPedidoB,
        estado: 'cancelamento_pendente',
        rescisao_solicitada_por: null,
        rescisao_effective_on: '2026-12-01',
      };

      getAgreementsForDriver
        .mockResolvedValueOnce([acordoA, acordoB])
        .mockResolvedValueOnce([acordoA, aposPedidoB])
        .mockResolvedValue([acordoA, aposPedidoB]);
      terminateAgreement.mockResolvedValue({
        id: 'acordo-b',
        estado: 'activo',
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'fim_ciclo',
      });

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Viana/i }));
      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      openAcordoKebab(dialog);
      await clickAcordoKebabItem(/Encerrar acordo/i);

      const picker = await screen.findByTestId('terminate-modality-picker');
      fireEvent.click(within(picker).getByRole('button', { name: /Acordo amigável/i }));
      const vigencia = await screen.findByTestId('terminate-vigencia-picker');
      fireEvent.click(within(vigencia).getByRole('button', { name: /Fim deste mês/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Encerrar acordo$/i }));

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledWith(
          'acordo-b',
          { modo: 'consensual', vigencia: 'fim_ciclo' },
          expect.any(Object),
        );
      });

      const feedback = await screen.findByTestId('agreements-feedback');
      await waitFor(() => {
        expect(feedback).toHaveTextContent(/A outra parte precisa de confirmar/i);
        expect(feedback).not.toHaveTextContent(copyAcordoA.corpo);
      });

      getAgreementsForDriver.mockResolvedValue([acordoA, aposConfirmacaoB]);
      notifyMarketplaceHubRefresh();

      await waitFor(() => {
        expect(screen.getByTestId('agreements-feedback')).toHaveTextContent(copyAcordoB.corpo);
        expect(screen.getByTestId('agreements-feedback')).not.toHaveTextContent(
          /A outra parte precisa de confirmar/i,
        );
      });
    });

    it('resposta antiga de carregar não fecha o sheet quando lista veio vazia', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const acordo = {
        ...acordoMotorista,
        id: 'acordo-1',
        estado: 'cancelamento_pendente',
        rescisao_effective_on: '2026-11-01',
      };

      let resolveLento;
      getAgreementsForDriver
        .mockResolvedValueOnce([acordo])
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveLento = () => resolve([]);
            }),
        )
        .mockResolvedValue([acordo]);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

      notifyMarketplaceHubRefresh();
      notifyMarketplaceHubRefresh();

      await waitFor(() => {
        expect(getAgreementsForDriver.mock.calls.length).toBeGreaterThanOrEqual(3);
      });

      await act(async () => {
        resolveLento();
        await Promise.resolve();
      });

      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    it('motorista: detalhe reflecte acordo cancelado após refresh do hub (sem remount)', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const aguardandoConfirmacao = {
        ...acordoMotorista,
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'imediato',
      };
      getAgreementsForDriver.mockResolvedValue([aguardandoConfirmacao]);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(within(dialog).getByTestId('rescisao-consensual-enviada')).toBeInTheDocument();
      expect(within(dialog).getByText(/^Activo$/i)).toBeInTheDocument();

      const encerrado = {
        ...aguardandoConfirmacao,
        estado: 'cancelado',
        rescisao_modo: null,
        rescisao_solicitada_por: null,
        rescisao_vigencia: null,
      };
      getAgreementsForDriver.mockResolvedValue([encerrado]);
      notifyMarketplaceHubRefresh();

      await waitFor(() => {
        expect(within(dialog).queryByTestId('rescisao-consensual-enviada')).not.toBeInTheDocument();
        expect(within(dialog).getByText(/^cancelado$/i)).toBeInTheDocument();
        expect(within(dialog).queryByText(/^Activo$/i)).not.toBeInTheDocument();
      });
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    it('duplo Confirmar após sucesso: RPC uma vez e sem alerta de erro', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger
        .mockResolvedValueOnce([acordoComPedidoMotorista])
        .mockResolvedValue([]);

      let rpcCalls = 0;
      terminateAgreement.mockImplementation(async () => {
        rpcCalls += 1;
        if (rpcCalls === 1) {
          return { id: 'acordo-pax', estado: 'cancelado' };
        }
        throw new Error('Sem permissão para rescindir este acordo.');
      });

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      const confirmar = within(dialog).getByTestId('rescisao-confirmar-cta');
      fireEvent.click(confirmar);

      await waitFor(() => {
        expect(rpcCalls).toBe(1);
        expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('passageiro: acordo fora da lista após refresh fecha detalhe (linha saiu)', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);

      renderPage();
      fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

      await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      expect(screen.getByTestId('rescisao-consensual-pendente')).toBeInTheDocument();

      getAgreementsForPassenger.mockResolvedValue([]);
      notifyMarketplaceHubRefresh();

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
      });
    });

    it('Fechar detalhe durante Confirmar em curso não reabre o sheet', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);

      let resolveTerminate;
      terminateAgreement.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveTerminate = resolve;
          }),
      );

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      fireEvent.click(within(dialog).getByTestId('rescisao-confirmar-cta'));
      fireEvent.click(within(dialog).getByTestId('acordo-detalhe-fechar'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
      });

      getAgreementsForPassenger.mockResolvedValue([
        {
          ...acordoComPedidoMotorista,
          estado: 'cancelado',
          rescisao_modo: null,
          rescisao_solicitada_por: null,
        },
      ]);
      resolveTerminate({ id: 'acordo-pax', estado: 'cancelado' });

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    });

    it('guard in-flight: duplo clique com RPC pendente só chama terminateAgreement uma vez', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);

      let resolveTerminate;
      let rpcCalls = 0;
      terminateAgreement.mockImplementation(
        () =>
          new Promise((resolve) => {
            rpcCalls += 1;
            resolveTerminate = resolve;
          }),
      );

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      const confirmar = within(dialog).getByTestId('rescisao-confirmar-cta');
      act(() => {
        fireEvent.click(confirmar);
        fireEvent.click(confirmar);
      });

      await waitFor(() => {
        expect(rpcCalls).toBe(1);
      });
      expect(terminateAgreement).toHaveBeenCalledTimes(1);

      await act(async () => {
        getAgreementsForPassenger.mockResolvedValue([]);
        resolveTerminate({ id: 'acordo-pax', estado: 'cancelado' });
        await Promise.resolve();
      });
    });

    it('sem permissão: engole erro se refetch confirma acordo fora da lista', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger
        .mockResolvedValueOnce([acordoComPedidoMotorista])
        .mockResolvedValue([]);

      terminateAgreement.mockRejectedValue(
        new Error('Sem permissão para rescindir este acordo.'),
      );

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      fireEvent.click(within(dialog).getByTestId('rescisao-confirmar-cta'));

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
        expect(getAgreementsForPassenger.mock.calls.length).toBeGreaterThanOrEqual(2);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('sem permissão: mostra erro se refetch mantém acordo activo pendente', async () => {
      mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);

      terminateAgreement.mockRejectedValue(
        new Error('Sem permissão para rescindir este acordo.'),
      );

      renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      fireEvent.click(within(dialog).getByTestId('rescisao-confirmar-cta'));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Sem permissão para rescindir/i);
      });
    });

    it('sem permissão: engole erro se refetch confirma estado cancelado na lista', async () => {
      mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
      const pedidoPassageiro = {
        ...acordoMotorista,
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'pax-viewer',
        rescisao_vigencia: 'imediato',
      };
      const canceladoNaLista = {
        ...pedidoPassageiro,
        estado: 'cancelado',
        rescisao_modo: null,
        rescisao_solicitada_por: null,
        rescisao_vigencia: null,
      };
      getAgreementsForDriver
        .mockResolvedValueOnce([pedidoPassageiro])
        .mockResolvedValue([canceladoNaLista]);

      terminateAgreement.mockRejectedValue(
        new Error('Sem permissão para rescindir este acordo.'),
      );

      renderPage(['/acordos?openAcordoId=acordo-1&focus=rescisao']);

      const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
      fireEvent.click(within(dialog).getByTestId('rescisao-confirmar-cta'));

      await waitFor(() => {
        expect(terminateAgreement).toHaveBeenCalledTimes(1);
      });
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});

describe('MyAgreements — ENG#35 preço próximo mês', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordoMotorista]);
    getAgreementsForPassenger.mockResolvedValue([]);
    listAdendaHistorico.mockResolvedValue([]);
    setupPagamentosDefault();
  });

  it('motorista com acordo activo vê panel Próximo mês e CTA Mudar o preço', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const panel = within(dialog).getByTestId('preco-proximo-mes-panel');
    expect(within(panel).getByText(/^Próximo mês$/i)).toBeInTheDocument();
    expect(within(panel).getByTestId('mudar-preco-proximo-mes-cta')).toBeInTheDocument();
    openAcordoKebab(dialog);
    expect(screen.getByRole('menuitem', { name: /Registar falta/i })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /^Encerrar acordo$/i })).not.toBeInTheDocument();
  });

  it('passageiro activo vê panel Próximo mês', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    mockPagamentosGate(acordoPassageiro, 'pax-viewer');

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('preco-proximo-mes-panel')).toBeInTheDocument();
    expect(within(dialog).getByTestId('mudar-preco-proximo-mes-cta')).toBeInTheDocument();
  });

  it('acordo não activo: não vê panel de preço', async () => {
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoMotorista, id: 'acordo-cancelado', estado: 'cancelado' },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByTestId('preco-proximo-mes-panel')).not.toBeInTheDocument();
  });

  it('CTA Mudar o preço navega para ecrã novo', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('mudar-preco-proximo-mes-cta'));

    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/preco/novo');
  });

  it('com proposta pendente mostra Ver proposta e oculta Mudar o preço', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          id: 'adenda-1',
          estado: 'pendente_passageiro',
          effective_from: '2026-11-01',
          valor_mensal_por_passageiro_kz: 45000,
          valor_mensal_total_kz: 90000,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('preco-ver-proposta-cta')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('mudar-preco-proximo-mes-cta')).not.toBeInTheDocument();
  });

  it('proponente com proposta rejeitada vê Ver proposta recusada e Nova proposta', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          id: 'adenda-1',
          estado: 'rejeitada',
          created_by: 'driver-1',
          effective_from: '2026-11-01',
          valor_mensal_por_passageiro_kz: 26500,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const panel = within(dialog).getByTestId('preco-proximo-mes-panel');
    expect(within(panel).getByTestId('preco-proposta-recusada-cta')).toBeInTheDocument();
    expect(within(panel).getByTestId('mudar-preco-proximo-mes-cta')).toHaveTextContent(/Nova proposta/i);
  });

  it('contraparte com proposta rejeitada vê Ver proposta recusada sem Nova proposta', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoPassageiro,
        adenda_pendente: {
          id: 'adenda-1',
          estado: 'rejeitada',
          created_by: 'driver-1',
          effective_from: '2026-11-01',
          valor_mensal_por_passageiro_kz: 26500,
          applied_at: null,
        },
      },
    ]);
    mockPagamentosGate(acordoPassageiro, 'pax-viewer');

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const panel = within(dialog).getByTestId('preco-proximo-mes-panel');
    expect(within(panel).getByTestId('preco-proposta-recusada-cta')).toBeInTheDocument();
    expect(within(panel).queryByTestId('mudar-preco-proximo-mes-cta')).not.toBeInTheDocument();
  });

  it('com preço aceite agendado mostra Ver preço confirmado', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          estado: 'aceite',
          effective_from: '2026-11-01',
          valor_mensal_por_passageiro_kz: 45000,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('preco-ver-confirmado-cta')).toBeInTheDocument();
  });

  it('Ver proposta navega para ecrã de proposta', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        adenda_pendente: {
          id: 'adenda-1',
          estado: 'pendente_passageiro',
          effective_from: '2026-11-01',
          valor_mensal_por_passageiro_kz: 45000,
          applied_at: null,
        },
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('preco-ver-proposta-cta'));

    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/preco/proposta');
  });

  it('histórico chama listAdendaHistorico ao abrir detalhe', async () => {
    listAdendaHistorico.mockResolvedValue([
      { id: 'h1', estado: 'rejeitada', valor_mensal_por_passageiro_kz: 42000 },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    await waitFor(() => {
      expect(listAdendaHistorico).toHaveBeenCalledWith('acordo-1');
    });

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('preco-historico-resumo')).toBeInTheDocument();
  });

  it('Ver tudo no histórico navega para página histórico', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('preco-historico-ver-tudo'));

    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/preco/historico');
  });

  it('cancelamento_pendente mostra banner com data Luanda e vaga ocupada', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        estado: 'cancelamento_pendente',
        rescisao_effective_on: '2026-10-01',
      },
    ]);

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const banner = within(dialog).getByTestId('cancelamento-pendente-banner');
    expect(banner).toHaveTextContent(/30 de setembro de 2026/i);
    expect(banner).toHaveTextContent(/vaga permanece ocupada/i);
    expect(banner).toHaveTextContent(/quotas congeladas/i);
  });

  it('não mostra enum cru cancelamento_pendente no DOM', async () => {
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        estado: 'cancelamento_pendente',
        rescisao_effective_on: '2026-11-01',
      },
    ]);

    renderPage();

    expect(await screen.findByText('Cancelamento pendente')).toBeInTheDocument();
    expect(screen.queryByText('cancelamento_pendente')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).queryByText('cancelamento_pendente')).not.toBeInTheDocument();
  });

  it('não expõe jargon de produto na UI de acordos', async () => {
    renderPage();
    expect(await screen.findByText(/Acordos/i)).toBeInTheDocument();
    expectNoUserFacingJargon(document.body.textContent);
  });
});

describe('MyAgreements — PACOTE ENG #14 renovação período', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([{ ...acordoMotorista, renovacao_estado: null }]);
    getAgreementsForPassenger.mockResolvedValue([]);
    listPending.mockResolvedValue([]);
    setupPagamentosDefault();
  });

  it('mostra CTAs de renovação explícita para acordo activo', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('renovacao-periodo-panel')).toBeInTheDocument();
    expect(within(dialog).getByTestId('renovar-periodo-cta')).toBeInTheDocument();
    expect(within(dialog).getByTestId('nao-renovar-periodo-cta')).toBeInTheDocument();
  });

  it('renovar período navega para ecrã dedicado', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('renovar-periodo-cta'));

    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/renovar');
  });

  it('não renovar navega para ecrã dedicado', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('nao-renovar-periodo-cta'));

    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/nao-renovar');
  });

  it('oculta CTAs quando período já renovado', async () => {
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoMotorista, renovacao_estado: 'renovado', renovacao_proximo_mes: '2026-10-01' },
    ]);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('renovacao-periodo-panel')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('renovar-periodo-cta')).not.toBeInTheDocument();
    expect(within(dialog).getByText(/Período seguinte renovado/i)).toBeInTheDocument();
  });
});

describe('MyAgreements — cabeçalho fixo do sheet Detalhe do acordo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    setupPagamentosDefault(true);
    listAdendaHistorico.mockResolvedValue([]);
  });

  afterEach(() => {
    resetOverlayStackForTests();
  });

  it('cabeçalho sticky fora do corpo scrollável; Fechar e puxador permanecem no header', async () => {
    renderPage(['/acordos?openAcordoId=acordo-pax&focus=rescisao']);

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    const header = screen.getByTestId('acordo-detalhe-sheet-header');
    const body = screen.getByTestId('acordo-detalhe-sheet-body');

    expect(header.className).toMatch(/\bsticky\b/);
    expect(body).not.toContainElement(header);
    expect(within(header).getByTestId('sheet-drag-handle')).toBeInTheDocument();
    expect(within(header).getByTestId('acordo-detalhe-fechar')).toHaveAccessibleName(/Fechar/i);
    expect(within(header).getByRole('heading', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    expect(within(header).getByText(/^activo$/i)).toBeInTheDocument();
  });

  it('secções de focus têm scroll-margin para não ficarem debaixo do cabeçalho', async () => {
    renderPage(['/acordos?openAcordoId=acordo-pax&focus=pagamento']);

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    const pagamento = screen.getByTestId('acordo-pagamento-section');
    expect(pagamento.className).toMatch(/\bscroll-mt-acordo-detalhe\b/);
  });

  it('ao abrir, o foco vai para o botão Fechar', async () => {
    renderPage();

    const trigger = await screen.findByRole('button', { name: /Talatona/i });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const fechar = within(dialog).getByTestId('acordo-detalhe-fechar');

    await waitFor(() => {
      expect(document.activeElement).toBe(fechar);
    });
  });

  it('Tab no último focável do sheet volta ao Fechar; Shift+Tab no Fechar vai ao último', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const fechar = within(dialog).getByTestId('acordo-detalhe-fechar');

    await waitFor(() => {
      expect(document.activeElement).toBe(fechar);
    });

    const { getFocusableElements } = await import('../utils/focusTrap');
    const focusables = getFocusableElements(dialog);
    expect(focusables.length).toBeGreaterThan(1);

    const last = focusables[focusables.length - 1];
    last.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', keyCode: 9 });
    expect(document.activeElement).toBe(fechar);

    fechar.focus();
    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', keyCode: 9, shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('Tab não escapa para a shell por trás do sheet', async () => {
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const fechar = within(dialog).getByTestId('acordo-detalhe-fechar');

    await waitFor(() => {
      expect(document.activeElement).toBe(fechar);
    });

    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', keyCode: 9 });
    expect(dialog).toContainElement(document.activeElement);
  });

  it('Fechar devolve o foco ao cartão que abriu o sheet', async () => {
    renderPage();

    const trigger = await screen.findByRole('button', { name: /Talatona/i });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByTestId('acordo-detalhe-fechar'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(trigger);
  });

  it('Escape no picker de modalidade devolve foco ao kebab; sheet aberto; sem RPC', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const detalhe = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const kebab = within(detalhe).getByTestId('acordo-detalhe-kebab-trigger');

    openAcordoKebab(detalhe);
    fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar acordo/i }));
    await screen.findByRole('dialog', { name: /Como queres encerrar o acordo/i });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId('terminate-modality-picker')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    expect(document.activeElement).toBe(kebab);
    expect(terminateAgreement).not.toHaveBeenCalled();
  });

  it('Voltar no picker de modalidade devolve foco ao kebab', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const detalhe = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const kebab = within(detalhe).getByTestId('acordo-detalhe-kebab-trigger');

    openAcordoKebab(detalhe);
    fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar acordo/i }));
    const picker = await screen.findByRole('dialog', { name: /Como queres encerrar o acordo/i });
    fireEvent.click(within(picker).getByRole('button', { name: /^Voltar$/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('terminate-modality-picker')).not.toBeInTheDocument();
    });
    expect(document.activeElement).toBe(kebab);
    expect(terminateAgreement).not.toHaveBeenCalled();
  });

  it('Enter e Espaço no menuitem Encerrar acordo abrem o picker de modalidade', async () => {
    const user = userEvent.setup();
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Talatona/i }));
    const detalhe = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    openAcordoKebab(detalhe);
    const item = screen.getByRole('menuitem', { name: /Encerrar acordo/i });
    item.focus();
    await user.keyboard('{Enter}');
    expect(await screen.findByTestId('terminate-modality-picker')).toBeInTheDocument();

    const picker = await screen.findByRole('dialog', { name: /Como queres encerrar o acordo/i });
    fireEvent.click(within(picker).getByRole('button', { name: /^Voltar$/i }));
    await waitFor(() => {
      expect(screen.queryByTestId('terminate-modality-picker')).not.toBeInTheDocument();
    });

    openAcordoKebab(detalhe);
    const item2 = screen.getByRole('menuitem', { name: /Encerrar acordo/i });
    item2.focus();
    await user.keyboard(' ');
    expect(await screen.findByTestId('terminate-modality-picker')).toBeInTheDocument();
  });

  it('Tab no picker Encerrar acordo mantém foco no overlay empilhado', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const detalhe = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const fechar = within(detalhe).getByTestId('acordo-detalhe-fechar');

    openAcordoKebab(detalhe);
    fireEvent.click(screen.getByRole('menuitem', { name: /Encerrar acordo/i }));

    const picker = await screen.findByRole('dialog', { name: /Como queres encerrar o acordo/i });
    const avisoBtn = within(picker).getByRole('button', { name: /Aviso prévio/i });
    avisoBtn.focus();

    fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', keyCode: 9 });
    expect(picker).toContainElement(document.activeElement);
    expect(document.activeElement).not.toBe(fechar);
  });

  it('fechar com origem destacada do DOM não lança e não restaura foco', async () => {
    renderPage();

    const trigger = await screen.findByRole('button', { name: /Talatona/i });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    trigger.remove();

    expect(() => {
      fireEvent.click(within(dialog).getByTestId('acordo-detalhe-fechar'));
    }).not.toThrow();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    });
    expect(document.activeElement).not.toBe(trigger);
  });

  it('remove listener keydown capture ao desmontar o sheet', async () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    fireEvent.click(within(dialog).getByTestId('acordo-detalhe-fechar'));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    });

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    removeSpy.mockRestore();
  });

  it('focus=rescisao só scrolla quando o viewer é contraparte (não o requerente)', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');

    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoMotorista,
        rescisao_modo: 'consensual',
        rescisao_solicitada_por: 'driver-1',
        rescisao_vigencia: 'imediato',
      },
    ]);
    getAgreementsForPassenger.mockResolvedValue([]);

    renderPage(['/acordos?openAcordoId=acordo-1&focus=rescisao']);

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    await waitFor(() => {
      expect(scrollSpy).not.toHaveBeenCalled();
    });

    scrollSpy.mockRestore();
  });

  it('cabeçalho marca data-scrolled quando o corpo do sheet faz scroll', async () => {
    renderPage(['/acordos?openAcordoId=acordo-pax']);

    await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const header = screen.getByTestId('acordo-detalhe-sheet-header');
    const panel = screen.getByTestId('acordo-detalhe-sheet');

    expect(header).toHaveAttribute('data-scrolled', 'false');

    Object.defineProperty(panel, 'scrollTop', { value: 24, writable: true, configurable: true });
    fireEvent.scroll(panel);

    await waitFor(() => {
      expect(header).toHaveAttribute('data-scrolled', 'true');
    });
  });
});
