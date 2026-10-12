import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AcordoPagamentoPanel from './AcordoPagamentoPanel.jsx';

vi.mock('../services/PaymentService', () => ({
  getPlatformIban: vi.fn(() => 'AO06004000000000000000000'),
  uploadComprovativo: vi.fn(),
}));

import { getPlatformIban, uploadComprovativo } from '../services/PaymentService';

describe('AcordoPagamentoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPlatformIban).mockReturnValue('AO06004000000000000000000');
  });

  it('acordo activo: resumo Valor a pagar sem desagregação proporcional', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 15636,
          estado: 'pendente_pagamento',
        }}
        lugarEstado="activo"
        obrigacao={{
          dias: 8,
          dias_mes: 22,
          mes: '2026-10-01',
          quota: 43000,
          proporcional: 15636,
          pago: 0,
          valor_em_divida: 15636,
          prazo: '2026-10-12T12:00:00.000Z',
        }}
      />,
    );
    expect(screen.queryByTestId('linha-proporcional-pagamento')).not.toBeInTheDocument();
    expect(screen.getByTestId('linha-valor-pagar-resumo')).toHaveTextContent(/Valor a pagar:/);
    expect(screen.getByTestId('linha-prazo-pagamento')).toBeInTheDocument();
  });

  it('saída do acordo: mostra linha proporcional v1.4', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 15636,
          estado: 'pendente_pagamento',
        }}
        lugarEstado="saiu"
        pagamentoUiVariant="S2"
        obrigacao={{
          dias: 8,
          dias_mes: 22,
          mes: '2026-10-01',
          quota: 43000,
          proporcional: 15636,
          pago: 0,
          valor_em_divida: 15636,
          prazo: '2026-10-12T12:00:00.000Z',
        }}
      />,
    );
    expect(screen.getByTestId('linha-proporcional-pagamento')).toBeInTheDocument();
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

  it('sem IBAN: empty state e botão desactivado', () => {
    vi.mocked(getPlatformIban).mockReturnValue(null);

    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'pendente_pagamento',
        }}
      />,
    );

    expect(screen.getByTestId('iban-nao-configurado')).toBeInTheDocument();
    expect(screen.getByText(/Transferência indisponível/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Enviar comprovativo/i });
    expect(btn).toBeDisabled();
  });

  it('mostra preview do ficheiro e acção Substituir comprovativo', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'comprovativo_enviado',
          comprovativo_path: 'uid/pag-1/recibo-setembro.pdf',
        }}
      />,
    );

    expect(screen.getByTestId('comprovativo-preview')).toHaveTextContent('recibo-setembro.pdf');
    expect(screen.getByRole('button', { name: /Substituir comprovativo/i })).toBeInTheDocument();
  });

  it('estado anulado — chip Cancelado no painel', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-3',
          valor_kz: 0,
          estado: 'anulado',
        }}
      />,
    );
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar comprovativo/i })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: /Substituir comprovativo/i })).not.toBeInTheDocument();
  });

  it('upload chama serviço quando IBAN configurado', async () => {
    vi.mocked(uploadComprovativo).mockResolvedValue('pag-1');

    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-1',
          valor_kz: 43000,
          estado: 'pendente_pagamento',
        }}
      />,
    );

    const input = screen.getByTestId('comprovativo-input');
    const file = new File(['x'], 'comprovativo.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadComprovativo).toHaveBeenCalledWith('pag-1', file);
  });

  it('v1.6 excesso: Diferença em análise e linha secundária, sem check', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-ex',
          valor_kz: 0,
          estado: 'em_custodia',
          requer_resolucao_admin: true,
        }}
        obrigacao={{
          dias: 5,
          dias_mes: 22,
          mes: '2026-10-01',
          proporcional: 9773,
          pago: 12000,
          valor_em_divida: 0,
          quota: 43000,
        }}
      />,
    );
    expect(screen.getByText('Diferença em análise')).toBeInTheDocument();
    expect(screen.getByTestId('linha-excesso-pagamento')).toHaveTextContent(
      /correspondem a 5 de 22 dias úteis/,
    );
    expect(screen.queryByTestId('pagamento-estado-check')).not.toBeInTheDocument();
    expect(screen.queryByTestId('linha-proporcional-pagamento')).not.toBeInTheDocument();
  });

  it('v1.6 saiu com pagamento pendente: destaca valor em dívida', () => {
    render(
      <AcordoPagamentoPanel
        lugarEstado="saiu"
        pagamento={{
          id: 'pag-saiu',
          valor_kz: 8000,
          estado: 'pendente_pagamento',
        }}
        obrigacao={{
          quota: 43000,
          valor_em_divida: 8000,
          proporcional: 8000,
          dias: 4,
          dias_mes: 22,
          mes: '2026-10-01',
        }}
      />,
    );
    const destaque = screen.getByTestId('valor-em-divida-destaque');
    expect(destaque).toHaveTextContent(/8[\s\u00a0]?000/);
    expect(destaque.querySelector('.text-2xl')).toBeTruthy();
    expect(screen.queryByTestId('pagamento-estado-check')).not.toBeInTheDocument();
  });

  it('S1-B: obrigação valor 0 oculta prazo 72h e CTA de upload', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-zero',
          valor_kz: 0,
          estado: 'pendente_pagamento',
          prazo_pagamento_em: '2026-10-12T12:00:00.000Z',
        }}
        obrigacao={{
          valor: 0,
          valor_em_divida: 0,
          quota: 43000,
          prazo: '2026-10-12T12:00:00.000Z',
        }}
      />,
    );
    expect(screen.queryByTestId('linha-prazo-pagamento')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comprovativo-upload-btn')).not.toBeInTheDocument();
  });

  it('#251 comprovativo enviado: título longo só uma vez e sem linha Valor a pagar', () => {
    render(
      <AcordoPagamentoPanel
        pagamento={{
          id: 'pag-comp',
          valor_kz: 0,
          estado: 'comprovativo_enviado',
          comprovativo_path: 'uid/pag-comp/recibo.pdf',
        }}
        lugarEstado="activo"
        obrigacao={{
          quota: 43000,
          valor_em_divida: 0,
          prazo: '2026-10-12T12:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByTestId('pagamento-estado-chip')).toHaveTextContent(
      /Comprovativo enviado — aguarda validação\./,
    );
    expect(screen.queryAllByText(/Comprovativo enviado — aguarda validação\./)).toHaveLength(1);
    expect(screen.queryByTestId('linha-valor-pagar-resumo')).not.toBeInTheDocument();
    expect(screen.queryByText(/Valor a pagar:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/0[\s\u00a0]?000 Kz/)).not.toBeInTheDocument();
  });

  it('v1.6 em custódia sem dívida: mostra check', () => {
    render(
      <AcordoPagamentoPanel
        lugarEstado="activo"
        pagamento={{
          id: 'pag-ok',
          valor_kz: 0,
          estado: 'em_custodia',
        }}
        obrigacao={{ valor_em_divida: 0, quota: 43000 }}
      />,
    );
    expect(screen.getByTestId('pagamento-estado-check')).toBeInTheDocument();
  });
});
