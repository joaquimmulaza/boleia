import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MyAgreements from './MyAgreements';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'pax-1' },
    tipoPerfil: 'Passageiro',
  }),
}));

vi.mock('../services/AgreementService', () => ({
  getAgreementsForPassenger: vi.fn(),
  getAgreementsForDriver: vi.fn(),
  leavePassenger: vi.fn(),
  terminateAgreement: vi.fn(),
  renewAgreementPeriod: vi.fn(),
  declineAgreementRenewal: vi.fn(),
  renegotiateAgreementPricing: vi.fn(),
  acceptAgreementAdenda: vi.fn(),
  rejectAgreementAdenda: vi.fn(),
  cancelAgreementAdenda: vi.fn(),
  listAdendaHistorico: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/offlineQueue', () => ({
  listPending: vi.fn().mockResolvedValue([]),
}));

vi.mock('../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true, isOffline: false }),
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
  listMinhasAvaliacoesAcordo: vi.fn(),
}));

import { getAgreementsForPassenger } from '../services/AgreementService';
import {
  listPagamentosByAcordo,
  getPagamentoForPassageiro,
  getAcordoContactos,
  getMesReferenciaAtual,
} from '../services/PaymentService';
import { listMinhasAvaliacoesAcordo } from '../services/RatingService';

describe('MyAgreements — rating banner ENG#32c', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mes = getMesReferenciaAtual();
    getAgreementsForPassenger.mockResolvedValue([
      {
        id: 'acordo-1',
        estado: 'activo',
        valor_mensal_por_passageiro_kz: 25000,
        n_passageiros_contrato: 1,
        ofertas_capacidade: {
          origin_name: 'Talatona',
          destination_name: 'Mutual',
        },
        acordos_passageiros: [
          { id: 'ap-1', passenger_id: 'pax-1', estado: 'activo', quota_mensal_kz: 25000 },
        ],
      },
    ]);
    listPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pag-1',
        acordo_passageiro_id: 'ap-1',
        passenger_id: 'pax-1',
        estado: 'em_custodia',
        validado_em: new Date().toISOString(),
        mes_referencia: mes,
      },
    ]);
    getPagamentoForPassageiro.mockResolvedValue({
      id: 'pag-1',
      passenger_id: 'pax-1',
      estado: 'em_custodia',
      mes_referencia: mes,
    });
    getAcordoContactos.mockResolvedValue({
      bloqueado: false,
      motorista: { nome_completo: 'João M.' },
      passageiros: [],
    });
    listMinhasAvaliacoesAcordo.mockResolvedValue([]);
  });

  it('mostra banner «Avaliar motorista» com pagamento confirmado', async () => {
    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-1']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('acordo-rating-banner')).toBeInTheDocument();
    });
    expect(screen.getByTestId('acordo-rating-cta')).toHaveTextContent('Avaliar motorista');
  });

  it('mostra banner com pagamento legado só passenger_id', async () => {
    listPagamentosByAcordo.mockResolvedValue([
      {
        id: 'pag-1',
        passenger_id: 'pax-1',
        estado: 'em_custodia',
        validado_em: new Date().toISOString(),
        mes_referencia: getMesReferenciaAtual(),
      },
    ]);

    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-1']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('acordo-rating-banner')).toBeInTheDocument();
    });
  });

  it('paid exit navega para interstitial M2 antes de sair', async () => {
    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-1']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByTestId('acordo-rating-banner')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Sair só eu/i }));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/sair/avaliar');
    });
  });

  it('picker «Encerrar acordo» oferece «Sair só eu» acionável → M2', async () => {
    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-1']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Detalhe do acordo/i })).toBeInTheDocument();
    });

    const dialog = screen.getByRole('dialog', { name: /Detalhe do acordo/i });
    fireEvent.click(within(dialog).getByRole('button', { name: /Mais acções do acordo/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: /Encerrar acordo/i }));
    expect(screen.getByTestId('terminate-modality-picker')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('terminate-picker-sair-so-eu'));
    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/sair/avaliar');
  });

  it('navega para formulário ao clicar CTA', async () => {
    render(
      <MemoryRouter initialEntries={['/acordos?openAcordoId=acordo-1']}>
        <MyAgreements />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('acordo-rating-cta')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('acordo-rating-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/avaliar');
  });
});
