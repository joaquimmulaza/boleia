import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
  };
});

vi.mock('../services/RatingService', () => ({
  listMinhasAvaliacoesAcordo: vi.fn().mockResolvedValue([]),
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
import { listPending } from '../services/offlineQueue';
import {
  listPagamentosByAcordo,
  getPagamentoForPassageiro,
  getAcordoContactos,
  getMesReferenciaAtual,
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

/** @param {object} [acordo] @param {string} [viewerId] @param {boolean} [emCustodia] */
function mockPagamentosGate(acordo, viewerId, emCustodia = true) {
  const estado = emCustodia ? 'em_custodia' : 'pendente_pagamento';
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
    vi.clearAllMocks();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordoMotorista]);
    getAgreementsForPassenger.mockResolvedValue([]);
    listPending.mockResolvedValue([]);
    setupPagamentosDefault();
  });

  it('lista acordos activos com copy humana', async () => {
    renderPage();

    expect(await screen.findByText('Acordos')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Grupo · 3 pessoas/i)).toBeInTheDocument();
      expect(screen.getByText(/Kz \/ pessoa/i)).toBeInTheDocument();
    });
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

    expect(within(dialog).getByText('Ana Costa')).toBeInTheDocument();
    expect(within(dialog).getByText('João Pedro')).toBeInTheDocument();
    expect(within(dialog).getByText('Maria Silva')).toBeInTheDocument();

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

  it('passageiro activo: Sair só eu chama leavePassenger', async () => {
    mockAuth.mockReturnValue({ user: { id: 'pax-viewer' }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([acordoPassageiro]);
    leavePassenger.mockResolvedValue({ ok: true });

    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Sair só eu/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Sair$/i }));

    await waitFor(() => {
      expect(leavePassenger).toHaveBeenCalledWith('acordo-pax', 'pax-viewer');
    });
    expect(
      await screen.findByText(/Saíste do acordo\. A quota do mês mantém-se/i),
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
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);
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
      expect(
        within(dialog).queryByRole('button', { name: /Mais acções do acordo/i }),
      ).not.toBeInTheDocument();
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
      getAgreementsForPassenger.mockResolvedValue([acordoComPedidoMotorista]);

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
