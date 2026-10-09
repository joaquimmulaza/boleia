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

  it('acordo activo: título Pagamentos do mês', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado={false}
        rows={[
          {
            pagamento_id: 'pg-1',
            passenger_id: 'pax-1',
            passenger_nome: 'Ana',
            estado: 'pendente_pagamento',
            valor: 40000,
            valor_em_divida: 40000,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('motorista-pagamentos-titulo')).toHaveTextContent('Pagamentos do mês');
  });

  it('pendente: valor em dívida e prazo sem countdown', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado={false}
        rows={[
          {
            pagamento_id: 'pg-pend',
            passenger_id: 'pax-p',
            passenger_nome: 'Carlos',
            estado: 'pendente_pagamento',
            valor: 32000,
            valor_em_divida: 32000,
            prazo: '2026-10-15T23:59:59.000Z',
            dias: 10,
            dias_mes: 22,
            mes: '2026-10-01',
          },
        ]}
      />,
    );
    const row = screen.getByTestId('motorista-pagamento-pax-p');
    expect(row).toHaveTextContent(/Carlos · 32[\s\u00a0]?000 Kz/);
    expect(screen.getByTestId('motorista-linha-prazo')).toHaveTextContent(/^até \d/);
    expect(row.textContent).not.toMatch(/restante|countdown|h restantes/i);
  });

  it('S4 linha comprovativo em validação com valor_comprovativo da RPC', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado
        rows={[
          {
            pagamento_id: 'pg-2',
            passenger_id: 'pax-2',
            passenger_nome: 'João',
            estado: 'comprovativo_enviado',
            valor: 0,
            valor_em_divida: 0,
            valor_comprovativo: 55000,
            requer_resolucao_admin: false,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('motorista-pagamento-comprovativo-pax-2')).toHaveTextContent(
      /comprovativo de 55[\s\u00a0]?000 Kz em validação/,
    );
    expect(screen.getByText('Em validação')).toBeInTheDocument();
  });

  it('S4 acordo activo: comprovativo + prazo até data (sem countdown)', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado={false}
        rows={[
          {
            pagamento_id: 'pg-2',
            passenger_id: 'pax-2',
            passenger_nome: 'João',
            estado: 'comprovativo_enviado',
            valor: 0,
            valor_em_divida: 0,
            valor_comprovativo: 55000,
            prazo: '2026-10-20T12:00:00.000Z',
            requer_resolucao_admin: false,
          },
        ]}
      />,
    );
    const row = screen.getByTestId('motorista-pagamento-comprovativo-pax-2');
    expect(row).toHaveTextContent(/comprovativo de 55[\s\u00a0]?000 Kz em validação/);
    expect(screen.getByTestId('motorista-s4-prazo-pax-2')).toHaveTextContent(/^até \d/);
    expect(row.textContent).not.toMatch(/restante|countdown|h restantes/i);
  });

  it('S6b linha diferença em análise', () => {
    render(
      <AcordoPagamentosMotoristaPanel
        acordoTerminado
        rows={[
          {
            pagamento_id: 'pg-3',
            passenger_id: 'pax-3',
            passenger_nome: 'Ana',
            estado: 'em_custodia',
            requer_resolucao_admin: true,
            excesso_kz: 2227,
          },
        ]}
      />,
    );
    expect(screen.getByTestId('motorista-pagamento-excesso-pax-3')).toHaveTextContent(
      /diferença de 2[\s\u00a0]?227 Kz/,
    );
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
