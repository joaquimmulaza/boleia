import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AcordoPagamentosMotoristaPanel from './AcordoPagamentosMotoristaPanel.jsx';

describe('AcordoPagamentosMotoristaPanel — v1.6', () => {
  it('acordo terminado: título Pagamentos', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado
        rows={[
          {
            pagamento_id: 'pg-1',
            passenger_id: 'pax-1',
            passenger_nome: 'Maria',
            estado: 'em_custodia',
            valor: 5000,
            valor_em_divida: 5000,
            dias: 3,
            dias_mes: 22,
            mes: '2026-10-01',
            proporcional: 5000,
            pago: 0,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('motorista-pagamentos-titulo')).toHaveTextContent('Pagamentos');
  });

  it('acordo terminado com várias secções: Pagamentos deste acordo', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado
        multiplePaymentSections
        rows={[{ pagamento_id: 'pg-1', passenger_id: 'pax-1', estado: 'pendente_pagamento', valor: 1 }]}
      />,
    );
    expect(screen.getByTestId('motorista-pagamentos-titulo')).toHaveTextContent(
      'Pagamentos deste acordo',
    );
  });
});
