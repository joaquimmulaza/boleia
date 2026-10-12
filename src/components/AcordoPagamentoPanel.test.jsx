import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AcordoPagamentoPanel from './AcordoPagamentoPanel.jsx';

vi.mock('../services/PaymentService', () => ({
  getAcordoMotoristaDadosBancarios: vi.fn(),
  uploadComprovativo: vi.fn(),
}));

import {
  getAcordoMotoristaDadosBancarios,
  uploadComprovativo,
} from '../services/PaymentService';

const ACORDO_ID = 'acordo-pag-1';
const IBAN_MOTORISTA = 'AO06DRIVER000000000000001';

describe('AcordoPagamentoPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAcordoMotoristaDadosBancarios).mockResolvedValue({
      iban: IBAN_MOTORISTA,
      iban_titular: 'João Motorista',
    });
  });

  const renderPanel = (props = {}) => render(
    <AcordoPagamentoPanel
      acordoId={ACORDO_ID}
      pagamento={{
        id: 'pag-1',
        valor_kz: 43000,
        estado: 'pendente_pagamento',
      }}
      {...props}
    />,
  );

  it('acordo activo: resumo Valor a pagar sem desagregação proporcional', async () => {
    render(
      <AcordoPagamentoPanel
        acordoId={ACORDO_ID}
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
    await waitFor(() => {
      expect(getAcordoMotoristaDadosBancarios).toHaveBeenCalledWith(ACORDO_ID);
    });
    expect(screen.queryByTestId('linha-proporcional-pagamento')).not.toBeInTheDocument();
    expect(screen.getByTestId('linha-valor-pagar-resumo')).toHaveTextContent(/Valor a pagar:/);
    expect(screen.getByTestId('linha-prazo-pagamento')).toBeInTheDocument();
  });

  it('saída do acordo: mostra linha proporcional v1.4', async () => {
    render(
      <AcordoPagamentoPanel
        acordoId={ACORDO_ID}
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
    await waitFor(() => {
      expect(screen.getByTestId('motorista-bancos-iban')).toBeInTheDocument();
    });
    expect(screen.getByTestId('linha-proporcional-pagamento')).toBeInTheDocument();
  });

  it('mostra valor do acordo e IBAN do motorista via RPC', async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByTestId('motorista-bancos-iban')).toBeInTheDocument();
    });
    expect(screen.getByTestId('acordo-pagamento-panel')).toBeInTheDocument();
    expect(screen.getByText(/43[\s\u00a0]000/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(IBAN_MOTORISTA))).toBeInTheDocument();
    expect(screen.getByText(/João Motorista/)).toBeInTheDocument();
    expect(getAcordoMotoristaDadosBancarios).toHaveBeenCalledWith(ACORDO_ID);
    expect(screen.getByRole('button', { name: /Enviar comprovativo/i })).toBeEnabled();
  });

  it('erro na RPC: mensagem amigável e botão desactivado', async () => {
    vi.mocked(getAcordoMotoristaDadosBancarios).mockResolvedValue({
      iban: null,
      iban_titular: null,
      erro: 'Sem permissão para ver dados bancários deste acordo.',
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('motorista-bancos-erro')).toHaveTextContent(/Sem permissão/);
    });
    const btn = screen.getByRole('button', { name: /Enviar comprovativo/i });
    expect(btn).toBeDisabled();
  });

  it('sem IBAN do motorista: empty state e botão desactivado', async () => {
    vi.mocked(getAcordoMotoristaDadosBancarios).mockResolvedValue({
      iban: null,
      iban_titular: null,
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('iban-nao-configurado')).toBeInTheDocument();
    });
    expect(screen.getByText(/Transferência indisponível/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Enviar comprovativo/i });
    expect(btn).toBeDisabled();
  });

  it('mostra preview do ficheiro e acção Substituir comprovativo', async () => {
    renderPanel({
      pagamento: {
        id: 'pag-1',
        valor_kz: 43000,
        estado: 'comprovativo_enviado',
        comprovativo_path: 'uid/pag-1/recibo-setembro.pdf',
      },
    });

    await waitFor(() => {
      expect(screen.getByTestId('comprovativo-preview')).toBeInTheDocument();
    });
    expect(screen.getByTestId('comprovativo-preview')).toHaveTextContent('recibo-setembro.pdf');
    expect(screen.getByRole('button', { name: /Substituir comprovativo/i })).toBeInTheDocument();
  });

  it('estado anulado — chip Cancelado no painel', async () => {
    renderPanel({
      pagamento: {
        id: 'pag-3',
        valor_kz: 0,
        estado: 'anulado',
      },
    });
    await waitFor(() => {
      expect(screen.getByText('Cancelado')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Enviar comprovativo/i })).not.toBeInTheDocument();
  });

  it('não mostra upload quando pagamento já em custódia', async () => {
    renderPanel({
      pagamento: {
        id: 'pag-2',
        valor_kz: 43000,
        estado: 'em_custodia',
      },
    });
    await waitFor(() => {
      expect(getAcordoMotoristaDadosBancarios).toHaveBeenCalled();
    });
    expect(screen.queryByRole('button', { name: /Enviar comprovativo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Substituir comprovativo/i })).not.toBeInTheDocument();
  });

  it('upload chama serviço quando IBAN do motorista disponível', async () => {
    vi.mocked(uploadComprovativo).mockResolvedValue('pag-1');

    renderPanel();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Enviar comprovativo/i })).toBeEnabled();
    });

    const input = screen.getByTestId('comprovativo-input');
    const file = new File(['x'], 'comprovativo.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });

    expect(uploadComprovativo).toHaveBeenCalledWith('pag-1', file);
  });

  it('v1.6 excesso: Diferença em análise e linha secundária, sem check', async () => {
    render(
      <AcordoPagamentoPanel
        acordoId={ACORDO_ID}
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
    await waitFor(() => {
      expect(screen.getByText('Diferença em análise')).toBeInTheDocument();
    });
    expect(screen.getByTestId('linha-excesso-pagamento')).toHaveTextContent(
      /correspondem a 5 de 22 dias úteis/,
    );
    expect(screen.queryByTestId('pagamento-estado-check')).not.toBeInTheDocument();
    expect(screen.queryByTestId('linha-proporcional-pagamento')).not.toBeInTheDocument();
  });

  it('v1.6 saiu com pagamento pendente: destaca valor em dívida', async () => {
    render(
      <AcordoPagamentoPanel
        acordoId={ACORDO_ID}
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
    await waitFor(() => {
      expect(screen.getByTestId('valor-em-divida-destaque')).toBeInTheDocument();
    });
    const destaque = screen.getByTestId('valor-em-divida-destaque');
    expect(destaque).toHaveTextContent(/8[\s\u00a0]?000/);
    expect(destaque.querySelector('.text-2xl')).toBeTruthy();
    expect(screen.queryByTestId('pagamento-estado-check')).not.toBeInTheDocument();
  });

  it('S1-B: obrigação valor 0 oculta prazo 72h e CTA de upload', async () => {
    render(
      <AcordoPagamentoPanel
        acordoId={ACORDO_ID}
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
    await waitFor(() => {
      expect(getAcordoMotoristaDadosBancarios).toHaveBeenCalled();
    });
    expect(screen.queryByTestId('linha-prazo-pagamento')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comprovativo-upload-btn')).not.toBeInTheDocument();
  });

  it('v1.6 em custódia sem dívida: mostra check', async () => {
    render(
      <AcordoPagamentoPanel
        acordoId={ACORDO_ID}
        lugarEstado="activo"
        pagamento={{
          id: 'pag-ok',
          valor_kz: 0,
          estado: 'em_custodia',
        }}
        obrigacao={{ valor_em_divida: 0, quota: 43000 }}
      />,
    );
    await waitFor(() => {
      expect(screen.getByTestId('pagamento-estado-check')).toBeInTheDocument();
    });
  });
});
