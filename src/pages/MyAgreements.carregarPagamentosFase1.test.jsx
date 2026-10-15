import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';

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
  getAgreementById: vi.fn(),
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

vi.mock('../services/PaymentService', () => ({
  listPagamentosByAcordo: vi.fn().mockResolvedValue([]),
  getPagamentoForPassageiro: vi.fn(),
  getAcordoContactos: vi.fn().mockResolvedValue({ bloqueado: false, passageiros: [] }),
  getMesReferenciaAtual: vi.fn(() => '2026-10-01'),
  getObrigacaoPagamentoPassageiro: vi.fn(),
  listAnulacaoMotivoLugarAcordos: vi.fn().mockResolvedValue([]),
  listPagamentosPendentesMotoristaAcordo: vi.fn().mockResolvedValue([
    {
      pagamento_id: 'pg-deep',
      passenger_id: 'pax-1',
      passenger_nome: 'Ana Costa',
      estado: 'em_custodia',
      valor: 40000,
      valor_em_divida: 0,
    },
  ]),
}));

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
  getAgreementById,
} from '../services/AgreementService';
import { listPagamentosPendentesMotoristaAcordo } from '../services/PaymentService';
import { resetOverlayStackForTests } from '../utils/overlayStack';

const ACORDO_UUID = '3f42eca2-03c9-8153-b9ea-c6e621e03656';

const acordoDeep = {
  id: ACORDO_UUID,
  driver_id: 'driver-1',
  estado: 'activo',
  modo_preco: 'POR_PASSAGEIRO',
  n_passageiros_contrato: 2,
  valor_mensal_por_passageiro_kz: 40000,
  valor_mensal_total_kz: 80000,
  is_hidden_by_user: false,
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
  ],
};

function renderPage(initialEntries) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

describe('MyAgreements — carregar pagamentos fase 1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOverlayStackForTests();
    mockAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementById.mockResolvedValue(acordoDeep);
  });

  it('deep link UUID dispara getAgreementById antes da lista completa resolver', async () => {
    /** @type {string[]} */
    const timeline = [];

    getAgreementById.mockImplementation(async () => {
      timeline.push('getAgreementById:start');
      await new Promise((r) => setTimeout(r, 20));
      timeline.push('getAgreementById:end');
      return acordoDeep;
    });

    getAgreementsForDriver.mockImplementation(async () => {
      timeline.push('list:start');
      await new Promise((r) => setTimeout(r, 200));
      timeline.push('list:end');
      return [acordoDeep];
    });

    listPagamentosPendentesMotoristaAcordo.mockImplementation(async () => {
      timeline.push('pagamentos:start');
      await new Promise((r) => setTimeout(r, 20));
      timeline.push('pagamentos:end');
      return [
        {
          pagamento_id: 'pg-deep',
          passenger_id: 'pax-1',
          passenger_nome: 'Ana Costa',
          estado: 'em_custodia',
          valor: 40000,
          valor_em_divida: 0,
        },
      ];
    });

    renderPage([`/acordos?openAcordoId=${ACORDO_UUID}`]);

    await waitFor(() => {
      expect(timeline).toContain('getAgreementById:start');
    });

    expect(timeline).not.toContain('list:end');

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('motorista-pagamentos-panel')).toBeInTheDocument();
    });

    const listEndIdx = timeline.indexOf('list:end');
    if (listEndIdx >= 0) {
      expect(timeline.indexOf('pagamentos:end')).toBeLessThan(listEndIdx);
    }
  });

  it('deep link UUID inexistente/fora de RLS: sem crash, sem detalhe, sem dados stale', async () => {
    const FOREIGN_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    getAgreementById.mockResolvedValue(null);
    getAgreementsForDriver.mockResolvedValue([
      {
        id: 'outro-acordo',
        driver_id: 'driver-1',
        estado: 'activo',
        is_hidden_by_user: false,
        ofertas_capacidade: { origin_name: 'A', destination_name: 'B', departure_time: '08:00' },
        acordos_passageiros: [],
      },
    ]);

    renderPage([`/acordos?openAcordoId=${FOREIGN_UUID}`]);

    await waitFor(() => {
      expect(getAgreementById).toHaveBeenCalledWith(FOREIGN_UUID, {
        tipoPerfil: 'Motorista',
        userId: 'driver-1',
      });
    });

    await waitFor(() => {
      expect(getAgreementsForDriver).toHaveBeenCalled();
    });

    expect(screen.queryByRole('dialog', { name: /Detalhe do acordo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('motorista-pagamentos-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Ana Costa')).not.toBeInTheDocument();
  });
});
