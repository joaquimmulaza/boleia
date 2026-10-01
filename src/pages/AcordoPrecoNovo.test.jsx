import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AcordoPrecoNovo from './AcordoPrecoNovo';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'driver-1' }, tipoPerfil: 'Motorista' }),
}));

vi.mock('../hooks/useAcordoPrecoContext', () => ({
  useAcordoPrecoContext: vi.fn(),
}));

vi.mock('../services/AgreementService', () => ({
  renegotiateAgreementPricing: vi.fn(),
}));

import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import { renegotiateAgreementPricing } from '../services/AgreementService';

const baseCtx = {
  loading: false,
  error: '',
  acordo: {
    id: 'acordo-1',
    modo_preco: 'POR_PASSAGEIRO',
    n_passageiros_contrato: 2,
    valor_mensal_por_passageiro_kz: 25000,
  },
  janelaAberta: true,
  mesActualLabel: 'Outubro',
  effectiveFrom: '2026-11-01',
  precoActual: 25000,
  contraparteLabel: 'Ana S.',
  isMotorista: true,
  isPassageiro: false,
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/acordos/acordo-1/preco/novo']}>
      <Routes>
        <Route path="/acordos/:acordoId/preco/novo" element={<AcordoPrecoNovo />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcordoPrecoNovo — ENG#35', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAcordoPrecoContext.mockReturnValue(baseCtx);
    renegotiateAgreementPricing.mockResolvedValue({ id: 'acordo-1' });
  });

  it('mostra copy Figma e preview ao introduzir valor', () => {
    renderPage();
    expect(screen.getByText(/Até dia 28 · Outubro mantém-se/i)).toBeInTheDocument();
    expect(screen.getByText(/Propõe o valor do lugar/i)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('preco-novo-valor-input'), {
      target: { value: '28000' },
    });

    expect(screen.getByTestId('preco-preview-card')).toHaveTextContent(/28[\s.]?000 Kz/i);
    expect(screen.getByText(/Outubro mantém 25[\s.]?000 Kz/i)).toBeInTheDocument();
  });

  it('enviar proposta chama renegotiateAgreementPricing e navega', async () => {
    renderPage();
    fireEvent.change(screen.getByTestId('preco-novo-valor-input'), {
      target: { value: '28000' },
    });
    fireEvent.click(screen.getByTestId('preco-enviar-proposta-cta'));

    await waitFor(() => {
      expect(renegotiateAgreementPricing).toHaveBeenCalledWith('acordo-1', {
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 28000,
        n_passageiros: 2,
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith('/acordos/acordo-1/preco/proposta', { replace: true });
  });
});
