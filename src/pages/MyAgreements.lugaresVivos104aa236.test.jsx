/**
 * P0 QA acordo 104aa236 — contagens e filtros só lugares vivos.
 */
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import { getMesReferenciaAtual } from '../services/PaymentService.js';
import { resetOverlayStackForTests } from '../utils/overlayStack';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockAuth = vi.fn();
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => mockAuth() }));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn(),
  getAgreementsForPassenger: vi.fn(),
  leavePassenger: vi.fn(),
  countLugaresVivosAcordo: vi.fn().mockResolvedValue(1),
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
    listPagamentosPendentesMotoristaAcordo: vi.fn(),
  };
});

vi.mock('../services/RatingService', () => ({
  listMinhasAvaliacoesAcordo: vi.fn().mockResolvedValue([]),
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));

import { getAgreementsForDriver, getAgreementsForPassenger } from '../services/AgreementService';
import {
  listPagamentosByAcordo,
  getAcordoContactos,
  getObrigacaoPagamentoPassageiro,
  listPagamentosPendentesMotoristaAcordo,
} from '../services/PaymentService';

const ACORDO_ID = '104aa236';
const SEAT1 = 'pax-seat1';
const SEAT2 = 'pax-seat2-saiu';

const acordoBase = {
  id: ACORDO_ID,
  estado: 'activo',
  modo_preco: 'POR_PASSAGEIRO',
  n_passageiros_contrato: 2,
  valor_mensal_por_passageiro_kz: 43000,
  is_hidden_by_user: false,
  ofertas_capacidade: {
    origin_name: 'Talatona',
    destination_name: 'Mutual',
    departure_time: '07:15',
  },
};

function linhasMotorista() {
  return [
    {
      id: 'ap-1',
      passenger_id: SEAT1,
      estado: 'reservado',
      quota_mensal_kz: 43000,
      perfis: { nome_completo: 'Passageiro A' },
    },
    {
      id: 'ap-2',
      passenger_id: SEAT2,
      estado: 'saiu',
      quota_mensal_kz: 43000,
      perfis: { nome_completo: 'Passageiro B' },
    },
  ];
}

function mockPagamentos104aa236() {
  const mes = getMesReferenciaAtual();
  listPagamentosByAcordo.mockResolvedValue([
    {
      id: 'pag-1',
      passenger_id: SEAT1,
      estado: 'pendente_pagamento',
      valor_kz: 43000,
      mes_referencia: mes,
    },
    {
      id: 'pag-2',
      passenger_id: SEAT2,
      estado: 'anulado',
      anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
      valor_kz: 0,
      mes_referencia: mes,
    },
  ]);
  listPagamentosPendentesMotoristaAcordo.mockResolvedValue([
    {
      pagamento_id: 'pg-1',
      passenger_id: SEAT1,
      passenger_nome: 'Passageiro A',
      estado: 'pendente_pagamento',
      valor: 43000,
      quota: 43000,
    },
    {
      pagamento_id: 'pg-2',
      passenger_id: SEAT2,
      passenger_nome: 'Passageiro B',
      estado: 'anulado',
      valor: 43000,
      quota: 43000,
    },
  ]);
}

function renderPage() {
  resetOverlayStackForTests();
  return render(
    <MemoryRouter initialEntries={['/acordos']}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

describe('MyAgreements — lugares vivos acordo 104aa236', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAcordoContactos.mockResolvedValue({
      bloqueado: true,
      motivo: 'Disponíveis após pagamento em custódia.',
      motorista: { nome_completo: 'Mot', telefone: null },
    });
  });

  it('motorista: cabeçalho Passageiros · 1, contagem Reservados 1, chip Saiu no seat2', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoBase, acordos_passageiros: linhasMotorista() },
    ]);
    mockPagamentos104aa236();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await waitFor(() => {
      expect(listPagamentosPendentesMotoristaAcordo).toHaveBeenCalled();
    });

    expect(within(dialog).getByText(/Passageiros · 1/i)).toBeInTheDocument();
    expect(within(dialog).getByTestId('passageiros-contagem')).toHaveTextContent(
      'Confirmados 0 · Reservados 1',
    );
    expect(within(dialog).getByTestId(`passageiro-estado-chip-${SEAT2}`)).toHaveTextContent('Saiu');
    expect(within(dialog).queryByTestId(`motorista-pagamento-${SEAT2}`)).not.toBeInTheDocument();
    expect(within(dialog).getByTestId(`motorista-pagamento-${SEAT1}`)).toBeInTheDocument();
  });

  it('passageiro: cabeçalho Passageiros · 1 com uma linha (RLS)', async () => {
    mockAuth.mockReturnValue({ user: { id: SEAT1 }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoBase,
        acordos_passageiros: [
          {
            id: 'ap-1',
            passenger_id: SEAT1,
            estado: 'reservado',
            quota_mensal_kz: 43000,
            perfis: { nome_completo: 'Tu' },
          },
        ],
      },
    ]);
    mockPagamentos104aa236();
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      obrigacao: { valor_em_divida: 43000, quota: 43000 },
      pagamento: { estado: 'pendente_pagamento', valor_kz: 43000 },
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    expect(within(dialog).getByText(/Passageiros · 1/i)).toBeInTheDocument();
    expect(within(dialog).getAllByTestId(/^passenger-row-/).length).toBe(1);
  });

  it('motorista: cabeçalho Passageiros · 0 quando só há quem saiu', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([
      {
        ...acordoBase,
        acordos_passageiros: [
          {
            id: 'ap-2',
            passenger_id: SEAT2,
            estado: 'saiu',
            quota_mensal_kz: 43000,
            perfis: { nome_completo: 'Passageiro B' },
          },
        ],
      },
    ]);
    mockPagamentos104aa236();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    expect(within(dialog).getByText(/Passageiros · 0/i)).toBeInTheDocument();
  });

  it('passageiro: contactos do RPC não filtrados pelas linhas locais (RLS)', async () => {
    mockAuth.mockReturnValue({ user: { id: SEAT1 }, tipoPerfil: 'Passageiro' });
    getAgreementsForPassenger.mockResolvedValue([
      {
        ...acordoBase,
        acordos_passageiros: [
          {
            id: 'ap-1',
            passenger_id: SEAT1,
            estado: 'reservado',
            quota_mensal_kz: 43000,
            perfis: { nome_completo: 'Tu' },
          },
        ],
      },
    ]);
    mockPagamentos104aa236();
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      obrigacao: { valor_em_divida: 0, quota: 43000 },
      pagamento: { estado: 'em_custodia', valor_kz: 43000 },
    });
    getAcordoContactos.mockResolvedValue({
      bloqueado: false,
      motorista: { nome_completo: 'Mot', telefone: '923000000' },
      passageiros: [
        { passenger_id: SEAT1, nome_completo: 'Tu', telefone: '923111111' },
        { passenger_id: SEAT2, nome_completo: 'Co-passageiro', telefone: '923222222' },
      ],
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await waitFor(() => {
      expect(within(dialog).getByTestId('contactos-desbloqueados')).toBeInTheDocument();
    });
    expect(within(dialog).getByText(/Co-passageiro/)).toBeInTheDocument();
    expect(within(dialog).getByText('923222222')).toBeInTheDocument();
  });

  it('motorista: contactos desbloqueados só passageiros vivos', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoBase, acordos_passageiros: linhasMotorista() },
    ]);
    mockPagamentos104aa236();
    getAcordoContactos.mockResolvedValue({
      bloqueado: false,
      motorista: { nome_completo: 'Mot', telefone: '923000000' },
      passageiros: [
        { passenger_id: SEAT1, nome_completo: 'Passageiro A', telefone: '923111111' },
        { passenger_id: SEAT2, nome_completo: 'Passageiro B', telefone: '923222222' },
      ],
    });

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    const contactosSec = await within(dialog).findByTestId('contactos-desbloqueados');
    expect(within(contactosSec).getByText(/Passageiro A/)).toBeInTheDocument();
    expect(within(contactosSec).queryByText(/Passageiro B/)).not.toBeInTheDocument();
  });

  it('contactos bloqueados: aguardar pagamento só do passageiro vivo', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoBase, acordos_passageiros: linhasMotorista() },
    ]);
    mockPagamentos104aa236();

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    await waitFor(() => {
      expect(within(dialog).getByTestId('contactos-aguardar-pagamento')).toBeInTheDocument();
    });
    const aguardar = within(dialog).getByTestId('contactos-aguardar-pagamento');
    expect(aguardar).toHaveTextContent(/Passageiro A/);
    expect(aguardar).not.toHaveTextContent(/Passageiro B/);
  });
});
