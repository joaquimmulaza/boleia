import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AcordoPrecoProposta from './AcordoPrecoProposta';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../hooks/useAcordoPrecoContext', () => ({
  useAcordoPrecoContext: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  acceptAgreementAdenda: vi.fn(),
  rejectAgreementAdenda: vi.fn(),
  cancelAgreementAdenda: vi.fn(),
}));

import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import {
  acceptAgreementAdenda,
  cancelAgreementAdenda,
  rejectAgreementAdenda,
} from '../services/AgreementService';

const baseCtx = {
  loading: false,
  error: '',
  acordo: { id: 'acordo-1', driver_id: 'driver-1' },
  user: { id: 'pax-1' },
  janelaAberta: true,
  mesActualLabel: 'Outubro',
  effectiveFrom: '2026-11-01',
  precoActual: 25000,
  contraparteLabel: 'João M.',
  isMotorista: false,
  isPassageiro: true,
  reload: vi.fn().mockResolvedValue(undefined),
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/acordos/acordo-1/preco/proposta']}>
      <Routes>
        <Route path="/acordos/:acordoId/preco/proposta" element={<AcordoPrecoProposta />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcordoPrecoProposta — ENG#35', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('contraparte vê Aceitar, Contra-propor e Recusar', () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      negociacao: {
        id: 'adenda-1',
        estado: 'pendente_passageiro',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });

    renderPage();

    expect(screen.getByTestId('preco-proposta-view-receber')).toBeInTheDocument();
    expect(screen.getByTestId('preco-aceitar-cta')).toBeInTheDocument();
    expect(screen.getByTestId('preco-contra-propor-cta')).toBeInTheDocument();
    expect(screen.getByTestId('preco-recusar-cta')).toBeInTheDocument();
    expect(screen.getByText(/Recusar o preço ≠ Não renovar o acordo/i)).toBeInTheDocument();
  });

  it('aceitar chama acceptAgreementAdenda', async () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      negociacao: {
        id: 'adenda-1',
        estado: 'pendente_passageiro',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });
    acceptAgreementAdenda.mockResolvedValue({ id: 'adenda-1', estado: 'aceite_agendada' });

    renderPage();
    fireEvent.click(screen.getByTestId('preco-aceitar-cta'));

    await waitFor(() => {
      expect(acceptAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });
  });

  it('após recusa contraparte pode Voltar a aceitar', async () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      negociacao: {
        id: 'adenda-1',
        estado: 'rejeitada',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });
    acceptAgreementAdenda.mockResolvedValue({ id: 'adenda-1', estado: 'aceite_agendada' });

    renderPage();
    expect(screen.getByTestId('preco-proposta-view-recusada_contraparte')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preco-voltar-aceitar-cta'));

    await waitFor(() => {
      expect(acceptAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });
  });

  it('passageiro propôs, motorista recusou — motorista pode Voltar a aceitar', async () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      user: { id: 'driver-1' },
      isMotorista: true,
      isPassageiro: false,
      negociacao: {
        id: 'adenda-1',
        estado: 'rejeitada',
        created_by: 'pax-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });
    acceptAgreementAdenda.mockResolvedValue({ id: 'adenda-1', estado: 'aceite_agendada' });

    renderPage();
    expect(screen.getByTestId('preco-proposta-view-recusada_contraparte')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preco-voltar-aceitar-cta'));

    await waitFor(() => {
      expect(acceptAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });
  });

  it('proponente pode Nova proposta após recusa', async () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      user: { id: 'driver-1' },
      isMotorista: true,
      isPassageiro: false,
      negociacao: {
        id: 'adenda-1',
        estado: 'rejeitada',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });

    renderPage();
    expect(screen.getByTestId('preco-proposta-view-recusada_proponente')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preco-nova-proposta-cta'));
    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/preco/novo');
  });

  it('proponente pode Retirar após recusa', async () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      user: { id: 'driver-1' },
      isMotorista: true,
      isPassageiro: false,
      negociacao: {
        id: 'adenda-1',
        estado: 'rejeitada',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });
    cancelAgreementAdenda.mockResolvedValue({ id: 'adenda-1', estado: 'cancelada_iniciador' });

    renderPage();
    expect(screen.getByTestId('preco-proposta-view-recusada_proponente')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preco-retirar-cta'));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^Retirar$/i }));

    await waitFor(() => {
      expect(cancelAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });
  });

  it('recusar abre confirmação e chama rejectAgreementAdenda', async () => {
    useAcordoPrecoContext.mockReturnValue({
      ...baseCtx,
      negociacao: {
        id: 'adenda-1',
        estado: 'pendente_passageiro',
        created_by: 'driver-1',
        effective_from: '2026-11-01',
        valor_mensal_por_passageiro_kz: 28000,
      },
    });
    rejectAgreementAdenda.mockResolvedValue({ id: 'adenda-1', estado: 'rejeitada' });

    renderPage();
    fireEvent.click(screen.getByTestId('preco-recusar-cta'));
    const modal = await screen.findByRole('dialog');
    fireEvent.click(within(modal).getByRole('button', { name: /^Recusar$/i }));

    await waitFor(() => {
      expect(rejectAgreementAdenda).toHaveBeenCalledWith('adenda-1');
    });
  });
});
