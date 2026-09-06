import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminPagamentos from './AdminPagamentos.jsx';

vi.mock('../services/PaymentService', () => ({
  listPagamentosPendentesValidacao: vi.fn(),
  listPagamentosEmCustodia: vi.fn(),
  listRepassesMotorista: vi.fn(),
  adminValidatePayment: vi.fn(),
  adminLiquidatePayment: vi.fn(),
  adminLiquidatePeriod: vi.fn(),
  getComprovativoSignedUrl: vi.fn(),
  getMesReferenciaAtual: vi.fn(),
}));

import {
  listPagamentosPendentesValidacao,
  listPagamentosEmCustodia,
  listRepassesMotorista,
  adminValidatePayment,
  adminLiquidatePayment,
  adminLiquidatePeriod,
  getComprovativoSignedUrl,
  getMesReferenciaAtual,
} from '../services/PaymentService';

describe('AdminPagamentos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listPagamentosEmCustodia.mockResolvedValue([]);
    listRepassesMotorista.mockResolvedValue([]);
    getMesReferenciaAtual.mockReturnValue('2026-09-01');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa título e separadores «Pagamentos e repasses»', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([]);

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Pagamentos e repasses/i })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: /Validar comprovativos/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Custódia e liquidação/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Repasses motorista/i })).toBeInTheDocument();
  });

  it('rejeitar abre modal em vez de window.prompt', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([
      {
        id: 'pag-1',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        comprovativo_path: 'uid/pag-1/recibo.pdf',
        perfis: { nome_completo: 'Maria' },
      },
    ]);
    adminValidatePayment.mockResolvedValue('pag-1');

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-fila-pagamentos')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /^Rejeitar$/i }));
    expect(screen.getByTestId('rejeicao-comprovativo-modal')).toBeInTheDocument();
    expect(window.prompt).toBeUndefined();

    fireEvent.change(screen.getByTestId('rejeicao-motivo-input'), {
      target: { value: 'Valor incorrecto' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar rejeição/i }));

    await waitFor(() => {
      expect(adminValidatePayment).toHaveBeenCalledWith('pag-1', false, 'Valor incorrecto');
    });
  });

  it('mostra nome do comprovativo e obtém URL assinada', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([
      {
        id: 'pag-2',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        comprovativo_path: 'uid/pag-2/foto.png',
        perfis: { nome_completo: 'João' },
      },
    ]);
    getComprovativoSignedUrl.mockResolvedValue('https://signed.example/foto.png');

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByTestId('comprovativo-admin-pag-2')).toHaveTextContent('foto.png');
    });

    fireEvent.click(screen.getByRole('button', { name: /Ver comprovativo/i }));

    await waitFor(() => {
      expect(getComprovativoSignedUrl).toHaveBeenCalledWith('uid/pag-2/foto.png');
      expect(screen.getByTestId('comprovativo-img-pag-2')).toBeInTheDocument();
    });
  });

  it('não expõe jargão inglês payout/GMV/take-rate na fila de validação', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([
      {
        id: 'pag-jargao',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        comprovativo_path: null,
        perfis: { nome_completo: 'Ana' },
      },
    ]);

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-fila-pagamentos')).toBeInTheDocument();
    });

    const fila = screen.getByTestId('admin-fila-pagamentos');
    expect(within(fila).getByText(/Repasse bruto/i)).toBeInTheDocument();
    expect(fila.textContent).not.toMatch(/\bpayout\b/i);
    expect(fila.textContent).not.toMatch(/\bGMV\b/i);
    expect(fila.textContent).not.toMatch(/take-rate/i);
  });

  it('lista pagamentos em custódia e liquida repasse', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([]);
    listPagamentosEmCustodia.mockResolvedValue([
      {
        id: 'pag-custodia',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        desconto_faltas_kz: 0,
        perfis: { nome_completo: 'Ana' },
      },
    ]);
    adminLiquidatePayment.mockResolvedValue('pag-custodia');

    render(<AdminPagamentos />);

    fireEvent.click(screen.getByRole('tab', { name: /Custódia e liquidação/i }));

    await waitFor(() => {
      expect(screen.getByTestId('admin-fila-custodia')).toBeInTheDocument();
    });

    expect(screen.getByText(/Repasse bruto/i)).toBeInTheDocument();
    expect(screen.queryByText(/\bPayout\b/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('liquidar-pag-custodia'));

    await waitFor(() => {
      expect(adminLiquidatePayment).toHaveBeenCalledWith('pag-custodia');
    });
  });

  it('liquidar período abre modal com mês Luanda e contagens antes do batch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));

    listPagamentosPendentesValidacao.mockResolvedValue([]);
    listPagamentosEmCustodia.mockResolvedValue([
      {
        id: 'pag-a',
        mes_referencia: '2026-09-01',
        valor_payout_liquido_kz: 38700,
        desconto_faltas_kz: 0,
        acordos: { driver_id: 'drv-1' },
      },
      {
        id: 'pag-b',
        mes_referencia: '2026-09-01',
        valor_payout_liquido_kz: 38700,
        desconto_faltas_kz: 0,
        acordos: { driver_id: 'drv-2' },
      },
      {
        id: 'pag-out',
        mes_referencia: '2026-08-01',
        valor_payout_liquido_kz: 38700,
        desconto_faltas_kz: 0,
        acordos: { driver_id: 'drv-3' },
      },
    ]);
    adminLiquidatePeriod.mockResolvedValue({
      pagamentos_liquidados: 2,
      repasses: [{ id: 'rep-1' }, { id: 'rep-2' }],
    });

    render(<AdminPagamentos />);

    fireEvent.click(screen.getByRole('tab', { name: /Custódia e liquidação/i }));

    await waitFor(() => {
      expect(screen.getByTestId('liquidar-periodo')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('liquidar-periodo'));

    const modal = screen.getByTestId('liquidacao-periodo-modal');
    expect(modal).toBeInTheDocument();
    expect(within(modal).getByRole('heading', { name: /setembro de 2026/i })).toBeInTheDocument();
    expect(within(modal).getByText(/2 pagamento/i)).toBeInTheDocument();
    expect(within(modal).getByText(/2 motorista/i)).toBeInTheDocument();
    expect(adminLiquidatePeriod).not.toHaveBeenCalled();

    fireEvent.click(within(modal).getByRole('button', { name: /Liquidar período/i }));

    await waitFor(() => {
      expect(adminLiquidatePeriod).toHaveBeenCalledWith('2026-09-01');
    });
  });

  it('secção motorista mostra mês, repasse líquido, taxa plataforma, IBAN e estado', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([]);
    listRepassesMotorista.mockResolvedValue([
      {
        id: 'rep-1',
        mes_referencia: '2026-09-01',
        gmv_kz: 86000,
        valor_plataforma_kz: 8600,
        valor_repasse_liquido_kz: 77400,
        desconto_faltas_kz: 0,
        iban_destino: 'AO06000000000000000000000',
        liquidado_em: '2026-09-06T10:00:00Z',
        perfis: { nome_completo: 'Carlos Motorista' },
      },
    ]);

    render(<AdminPagamentos />);

    fireEvent.click(screen.getByRole('tab', { name: /Repasses motorista/i }));

    await waitFor(() => {
      expect(screen.getByTestId('admin-repasses-lista')).toBeInTheDocument();
    });

    const card = screen.getByTestId('repasse-motorista-rep-1');
    expect(within(card).getByText(/Carlos Motorista/)).toBeInTheDocument();
    expect(within(card).getByTestId('repasse-campo-mes')).toHaveTextContent(/setembro de 2026/i);
    expect(within(card).getByTestId('repasse-campo-repasse-liquido')).toHaveTextContent(/77\s?400/);
    expect(within(card).getByTestId('repasse-campo-taxa-plataforma')).toHaveTextContent(/8\s?600/);
    expect(within(card).getByTestId('repasse-campo-iban')).toHaveTextContent(/AO06000000000000000000000/);
    expect(within(card).getByTestId('repasse-campo-estado')).toHaveTextContent(/Liquidado/i);

    expect(card.textContent).not.toMatch(/\bGMV\b/i);
    expect(card.textContent).not.toMatch(/\bpayout\b/i);
    expect(card.textContent).not.toMatch(/take-rate/i);
  });
});
