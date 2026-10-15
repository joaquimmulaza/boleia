/**
 * Softs #269 prod QA — nomes QA + quota expirada.
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForDriver: vi.fn(),
  getAgreementsForPassenger: vi.fn(),
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
    getAcordoContactos: vi.fn(),
    getObrigacaoPagamentoPassageiro: vi.fn(),
    listAnulacaoMotivoLugarAcordos: vi.fn().mockResolvedValue([
      {
        acordo_id: 'ac-269',
        passenger_id: 'pax-exp',
        anulacao_motivo: 'Prazo de reserva expirado',
        pagamento_estado: 'anulado',
      },
    ]),
    listPagamentosPendentesMotoristaAcordo: vi.fn().mockResolvedValue([]),
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

import { useAuth } from '../contexts/AuthContext';
import { getAgreementsForDriver } from '../services/AgreementService';
import { resetOverlayStackForTests } from '../utils/overlayStack';

const acordo = {
  id: 'ac-269',
  driver_id: 'driver-1',
  estado: 'activo',
  n_passageiros_contrato: 2,
  valor_mensal_por_passageiro_kz: 25000,
  ofertas_capacidade: {
    origin_name: 'Viana',
    destination_name: 'Centro',
    departure_time: '07:00',
  },
  acordos_passageiros: [
    {
      id: 'ap-qa1',
      passenger_id: 'pax-qa1',
      estado: 'activo',
      quota_mensal_kz: 25000,
      perfis: { nome_completo: 'QA Passageiro 3' },
    },
    {
      id: 'ap-exp',
      passenger_id: 'pax-exp',
      estado: 'expirado',
      quota_mensal_kz: 25000,
      perfis: { nome_completo: 'QA Passenger Three' },
    },
  ],
};

function renderPage() {
  resetOverlayStackForTests();
  return render(
    <MemoryRouter initialEntries={['/acordos?openAcordoId=ac-269']}>
      <MyAgreements />
    </MemoryRouter>,
  );
}

describe('MyAgreements soft #269', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' });
    getAgreementsForDriver.mockResolvedValue([acordo]);
  });

  it('motorista distingue passageiros QA pelo primeiro nome útil', async () => {
    renderPage();
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    expect(within(dialog).getByTestId('passenger-row-pax-qa1')).toHaveTextContent('Passageiro');
    expect(within(dialog).getByTestId('passenger-row-pax-exp')).toHaveTextContent('Passenger');
    expect(within(dialog).getByTestId('passenger-row-pax-qa1')).not.toHaveTextContent(/^QA\b/);
  });

  it('lugar expirado não mostra 25 000 Kz — mostra anulado', async () => {
    renderPage();
    const dialog = await screen.findByRole('dialog', { name: /Detalhe do acordo/i });
    const row = within(dialog).getByTestId('passenger-row-pax-exp');
    expect(row).not.toHaveTextContent(/25[\s\u00a0]?000 Kz/);
    expect(row).toHaveTextContent('0 Kz · anulado');
  });
});
