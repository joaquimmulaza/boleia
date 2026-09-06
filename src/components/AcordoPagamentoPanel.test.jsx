import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcordoPagamentoPanel from './AcordoPagamentoPanel.jsx';

vi.mock('../services/PaymentService', () => ({
  getPlatformIban: vi.fn(() => 'AO06004000000000000000000'),
  uploadComprovativo: vi.fn(),
}));

describe('AcordoPagamentoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mostra valor do acordo e IBAN da plataforma', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'pendente_pagamento',
        }}
      />,
    );
    expect(screen.getByTestId('acordo-pagamento-panel')).toBeInTheDocument();
    expect(screen.getByText(/43[\s\u00a0]000/)).toBeInTheDocument();
    expect(screen.getByText(/AO06004000000000000000000/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enviar comprovativo/i })).toBeInTheDocument();
  });

  it('não mostra upload quando pagamento já em custódia', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-2',
          valor_kz: 43000,
          estado: 'em_custodia',
        }}
      />,
    );
    expect(screen.queryByRole('button', { name: /Enviar comprovativo/i })).not.toBeInTheDocument();
  });
});
