/**
 * Critiquito QA #249 @ 6686de8 — legacy expirado + motivo saída voluntária.
 * Fixtures alinhadas aos lugares 7dad33e1 e 283be1da.
 */
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';

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
  countLugaresVivosAcordo: vi.fn().mockResolvedValue(2),
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
    listPagamentosByAcordo: vi.fn().mockResolvedValue([]),
    getPagamentoForPassageiro: vi.fn(),
    getAcordoContactos: vi.fn().mockResolvedValue({ bloqueado: false, passageiros: [], motorista: null }),
    getObrigacaoPagamentoPassageiro: vi.fn(),
    listAnulacaoMotivoLugarAcordos: vi.fn(),
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
} from '../services/AgreementService';
import {
  getObrigacaoPagamentoPassageiro,
  listAnulacaoMotivoLugarAcordos,
} from '../services/PaymentService';
import { resetOverlayStackForTests } from '../utils/overlayStack';

const SEAT_7DAD = '7dad33e1';
const SEAT_283B = '283be1da';
const ACORDO_QA = 'acordo-critiquito-qa';

const acordoBase = {
  id: ACORDO_QA,
  estado: 'cancelado',
  modo_preco: 'POR_PASSAGEIRO',
  n_passageiros_contrato: 1,
  valor_mensal_por_passageiro_kz: 16000,
  is_hidden_by_user: false,
  ofertas_capacidade: {
    origin_name: 'Talatona',
    destination_name: 'Mutual',
    departure_time: '07:15',
  },
};

/** @param {string} passengerId */
function linhaLegacyExpirado(passengerId) {
  return {
    id: `ap-${passengerId}`,
    passenger_id: passengerId,
    estado: 'expirado',
    quota_mensal_kz: 16000,
    perfis: { nome_completo: 'Passageiro QA' },
  };
}

/** @param {string} passengerId */
function mockMotivoRpc(passengerId) {
  listAnulacaoMotivoLugarAcordos.mockResolvedValue([
    {
      acordo_id: ACORDO_QA,
      acordo_passageiro_id: `ap-${passengerId}`,
      passenger_id: passengerId,
      anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
      pagamento_estado: 'anulado',
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

describe('Critiquito #249 — legacy expirado + motivo saída voluntária', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAnulacaoMotivoLugarAcordos.mockResolvedValue([]);
  });

  it('7dad33e1 passageiro: cartão e linha «Saiu» (não Expirado)', async () => {
    mockAuth.mockReturnValue({ user: { id: SEAT_7DAD }, tipoPerfil: 'Passageiro' });
    mockMotivoRpc(SEAT_7DAD);
    getAgreementsForPassenger.mockResolvedValue([
      { ...acordoBase, acordos_passageiros: [linhaLegacyExpirado(SEAT_7DAD)] },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      obrigacao: { valor_em_divida: 0 },
      pagamento: {
        estado: 'anulado',
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
        valor_quota_original_kz: 16000,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(listAnulacaoMotivoLugarAcordos).toHaveBeenCalled();
    });

    const chipCartao = await screen.findByTestId(`acordo-lugar-saiu-chip-${ACORDO_QA}`);
    expect(chipCartao).toHaveTextContent('Saiu');
    expect(chipCartao).not.toHaveTextContent('Expirado');

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Não tens nada a pagar/i });
    expect(within(dialog).getByTestId(`passageiro-estado-chip-${SEAT_7DAD}`)).toHaveTextContent('Saiu');
    expect(within(dialog).getByTestId(`acordo-lugar-saiu-chip-${ACORDO_QA}`)).toHaveTextContent('Saiu');
  });

  it('7dad33e1 motorista: linha passageiro «Saiu»', async () => {
    mockAuth.mockReturnValue({ user: { id: 'driver-qa' }, tipoPerfil: 'Motorista' });
    mockMotivoRpc(SEAT_7DAD);
    getAgreementsForDriver.mockResolvedValue([
      { ...acordoBase, acordos_passageiros: [linhaLegacyExpirado(SEAT_7DAD)] },
    ]);

    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });

    expect(within(dialog).getByTestId(`passageiro-estado-chip-${SEAT_7DAD}`)).toHaveTextContent('Saiu');
    expect(within(dialog).getByTestId(`passageiro-estado-chip-${SEAT_7DAD}`)).not.toHaveTextContent('Expirado');
  });

  it('283be1da passageiro: sheet S3 (motivo via RPC quando obrigação omite anulacao_motivo)', async () => {
    mockAuth.mockReturnValue({ user: { id: SEAT_283B }, tipoPerfil: 'Passageiro' });
    mockMotivoRpc(SEAT_283B);
    getAgreementsForPassenger.mockResolvedValue([
      { ...acordoBase, acordos_passageiros: [linhaLegacyExpirado(SEAT_283B)] },
    ]);
    getObrigacaoPagamentoPassageiro.mockResolvedValue({
      obrigacao: { valor_em_divida: 0 },
      pagamento: {
        estado: 'anulado',
        valor_quota_original_kz: 16000,
      },
    });

    renderPage();

    await waitFor(() => {
      expect(listAnulacaoMotivoLugarAcordos).toHaveBeenCalled();
    });
    expect(await screen.findByTestId(`acordo-lugar-saiu-chip-${ACORDO_QA}`)).toHaveTextContent('Saiu');

    fireEvent.click(await screen.findByRole('button', { name: /Talatona/i }));
    const dialog = await screen.findByRole('dialog', { name: /Não tens nada a pagar/i });
    expect(screen.queryByRole('dialog', { name: /A tua reserva expirou/i })).not.toBeInTheDocument();
    expect(within(dialog).getByTestId(`acordo-lugar-saiu-chip-${ACORDO_QA}`)).toHaveTextContent('Saiu');
  });
});
