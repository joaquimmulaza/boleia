import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AcordoRenovar from './AcordoRenovar';

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
  renewAgreementPeriod: vi.fn(),
}));

import { useAcordoPrecoContext } from '../hooks/useAcordoPrecoContext';
import { renewAgreementPeriod } from '../services/AgreementService';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/acordos/acordo-1/renovar']}>
      <Routes>
        <Route path="/acordos/:acordoId/renovar" element={<AcordoRenovar />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AcordoRenovar — ENG#35', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAcordoPrecoContext.mockReturnValue({
      loading: false,
      error: '',
      acordo: { id: 'acordo-1', renovacao_proximo_mes: '2026-11-01' },
      precoActual: 25000,
      contraparteLabel: 'Ana S.',
      rotaLabel: 'Talatona → Mutual',
      mesActualLabel: 'Outubro',
      negociacao: null,
    });
    renewAgreementPeriod.mockResolvedValue({ renovacao_proximo_mes: '2026-11-01' });
  });

  it('confirmar renovação chama renewAgreementPeriod', async () => {
    renderPage();
    fireEvent.click(screen.getByTestId('confirmar-renovacao-cta'));

    await waitFor(() => {
      expect(renewAgreementPeriod).toHaveBeenCalledWith('acordo-1');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/acordos', { replace: true });
  });
});
