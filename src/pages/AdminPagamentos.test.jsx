import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import AdminPagamentos from './AdminPagamentos.jsx';
import {
  ADMIN_RESOLUCAO_COPY,
  TOAST_ID_ACORDO_COPIADO,
} from '../utils/adminResolucaoPagamento.js';

vi.mock('../services/PaymentService', () => ({
  listPagamentosPendentesValidacao: vi.fn(),
  listPagamentosEmCustodia: vi.fn(),
  listRepassesMotorista: vi.fn(),
  listPagamentosResolucaoAdmin: vi.fn(),
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
  listPagamentosResolucaoAdmin,
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
    listPagamentosResolucaoAdmin.mockResolvedValue([]);
    getMesReferenciaAtual.mockReturnValue('2026-09-01');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tab validar mostra guia piloto B3', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([]);

    render(<AdminPagamentos />);

    await waitFor(() => {
      expect(screen.getByTestId('admin-piloto-ops-guia')).toBeInTheDocument();
    });
    expect(screen.getByTestId('admin-piloto-ops-guia')).toHaveTextContent(/Aprovar/i);
    expect(screen.getByTestId('admin-piloto-ops-guia')).toHaveTextContent(/custódia/i);
  });

  it('tab custódia avisa motoristas sem IBAN completo (B4)', async () => {
    listPagamentosPendentesValidacao.mockResolvedValue([]);
    listPagamentosEmCustodia.mockResolvedValue([
      {
        id: 'pag-sem-iban',
        valor_kz: 43000,
        valor_payout_liquido_kz: 38700,
        desconto_faltas_kz: 0,
        mes_referencia: '2026-09-01',
        perfis: { nome_completo: 'Ana' },
        acordos: {
          driver_id: 'drv-x',
          perfis: { iban: '', iban_titular: '' },
        },
      },
    ]);

    render(<AdminPagamentos />);

    fireEvent.click(screen.getByRole('tab', { name: /Custódia e liquidação/i }));

    await waitFor(() => {
      expect(screen.getByTestId('admin-iban-aviso')).toBeInTheDocument();
    });
    expect(screen.getByTestId('admin-iban-aviso')).toHaveTextContent(/IBAN completo/i);
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

  describe('tab Resolução manual — cartão de excesso', () => {
    /** Caso prod: pagamento vs acordo com prefixos distintos */
    const acordoId = 'e4eea60c-0cbe-4723-841d-5fd0b47c9b65';
    const pagamentoId = '79687aac-0154-4b2e-9c1d-8a3f2e1d0c9b';

    it('valor principal é o excesso a devolver, não a quota nem valor_devido_kz', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
          resolucao_admin_motivo: 'Excesso de 11000 Kz após fim do acordo',
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('admin-resolucao-lista')).toBeInTheDocument();
      });

      const card = screen.getByTestId(`resolucao-pagamento-${pagamentoId}`);
      expect(within(card).getByTestId('resolucao-excesso-principal')).toHaveTextContent(/11\s?000/);
      expect(within(card).getByTestId('resolucao-excesso-principal')).not.toHaveTextContent(/22\s?000/);
    });

    it('usa labels aprovados no valor principal e na quota paga', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: 'pag-res-labels',
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-label-excesso')).toBeInTheDocument();
      });
      expect(screen.getByTestId('resolucao-label-excesso')).toHaveTextContent(
        ADMIN_RESOLUCAO_COPY.excessoReembolso,
      );
      expect(screen.getByTestId('resolucao-quota-paga')).toHaveTextContent(
        ADMIN_RESOLUCAO_COPY.quotaPaga,
      );
    });

    it('quota paga usa tom muted e tamanho menor que o valor destacado', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: 'pag-res-muted',
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-quota-paga')).toBeInTheDocument();
      });
      expect(screen.getByTestId('resolucao-quota-paga').className).toMatch(/text-muted-foreground/);
      expect(screen.getByTestId('resolucao-quota-paga').className).toMatch(/text-sm/);
      expect(screen.getByTestId('resolucao-excesso-principal').className).toMatch(/text-xl/);
    });

    it('mostra linha secundária Quota paga com valor pago confirmado', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: 'pag-res-1',
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-quota-paga')).toBeInTheDocument();
      });
      expect(screen.getByTestId('resolucao-quota-paga')).toHaveTextContent(/Quota paga/i);
      expect(screen.getByTestId('resolucao-quota-paga')).toHaveTextContent(/22\s?000/);
    });

    it('mostra identificador do acordo (curto + id completo acessível)', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'liquidado',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-acordo-id')).toBeInTheDocument();
      });
      const acordoEl = screen.getByTestId('resolucao-acordo-id');
      expect(acordoEl).toHaveTextContent(`${ADMIN_RESOLUCAO_COPY.idAcordo}: e4eea60c`);
      expect(acordoEl).toHaveAttribute('title', acordoId);
      expect(acordoEl.textContent).not.toMatch(/79687aac/);
      expect(screen.getByText(new RegExp(`Pagamento ${pagamentoId}`))).toBeInTheDocument();
    });

    it('botão copiar grava UUID completo e mostra toast ID copiado.', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText);

      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoId}`)).toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole('button', { name: ADMIN_RESOLUCAO_COPY.copiarIdAcordoAria }),
      );

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledTimes(1);
        expect(writeText).toHaveBeenCalledWith(acordoId);
        expect(writeText).not.toHaveBeenCalledWith(pagamentoId);
        expect(screen.getByTestId('resolucao-id-copiado-toast')).toHaveTextContent(
          TOAST_ID_ACORDO_COPIADO,
        );
      });
    });

    it('interpretação errada (mostrar devido como principal) falha no caso pago 22000 / devido 8000', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: 'pag-res-divergente',
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 8000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-excesso-principal')).toBeInTheDocument();
      });
      const principal = screen.getByTestId('resolucao-excesso-principal');
      expect(principal).toHaveTextContent(/14\s?000/);
      expect(principal).not.toHaveTextContent(/^8\s?000/);
    });

    it('excesso negativo aparece como 0 Kz no cartão', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: 'pag-res-sem-excesso',
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 5000,
          valor_pago_confirmado_kz: 5000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-excesso-principal')).toBeInTheDocument();
      });
      expect(screen.getByTestId('resolucao-excesso-principal')).toHaveTextContent(/0/);
    });

    it('B1: valor_devido_kz null mostra «—» no valor principal (não 22 000 Kz)', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: null,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-excesso-principal')).toBeInTheDocument();
      });
      const principal = screen.getByTestId('resolucao-excesso-principal');
      expect(principal).toHaveTextContent('—');
      expect(principal).not.toHaveTextContent(/22\s?000/);
    });

    it('S5: toast de cópia keyed por pagamento — dois rows mesmo acordo, só um toast', async () => {
      const pagamentoA = '79687aac-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      const pagamentoB = '79687aac-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoA,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
        {
          id: pagamentoB,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoA}`)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoA}`));

      await waitFor(() => {
        expect(screen.getAllByTestId('resolucao-id-copiado-toast')).toHaveLength(1);
      });

      const cardB = screen.getByTestId(`resolucao-pagamento-${pagamentoB}`);
      expect(within(cardB).queryByTestId('resolucao-id-copiado-toast')).not.toBeInTheDocument();
    });

    it('S4: segundo clique copiar reinicia timeout (fake timers)', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoId}`)).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoId}`));
      });
      await waitFor(() => {
        expect(screen.getByTestId('resolucao-id-copiado-toast')).toBeInTheDocument();
      });

      await act(async () => {
        vi.advanceTimersByTime(2000);
        fireEvent.click(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoId}`));
      });
      await act(async () => {
        vi.advanceTimersByTime(2500);
      });
      expect(screen.getByTestId('resolucao-id-copiado-toast')).toBeInTheDocument();
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.queryByTestId('resolucao-id-copiado-toast')).not.toBeInTheDocument();
    });

    it('S6: breakpoint inclui 390px (min-[391px] no label longo)', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId('resolucao-label-excesso')).toBeInTheDocument();
      });
      const label = screen.getByTestId('resolucao-label-excesso');
      expect(label.querySelector('.min-\\[391px\\]\\:inline')).toBeTruthy();
      expect(label.querySelector('.min-\\[391px\\]\\:hidden')).toBeTruthy();
    });

    it('S8: botão copiar tem touch target >=44px (h-11 w-11)', async () => {
      listPagamentosPendentesValidacao.mockResolvedValue([]);
      listPagamentosResolucaoAdmin.mockResolvedValue([
        {
          id: pagamentoId,
          acordo_id: acordoId,
          estado: 'em_custodia',
          valor_kz: 22000,
          valor_pago_confirmado_kz: 22000,
          valor_devido_kz: 11000,
          requer_resolucao_admin: true,
        },
      ]);

      render(<AdminPagamentos />);
      fireEvent.click(screen.getByRole('tab', { name: /Resolução manual/i }));

      await waitFor(() => {
        expect(screen.getByTestId(`resolucao-copiar-acordo-${pagamentoId}`)).toBeInTheDocument();
      });
      const btn = screen.getByTestId(`resolucao-copiar-acordo-${pagamentoId}`);
      expect(btn.className).toMatch(/\bh-11\b/);
      expect(btn.className).toMatch(/\bw-11\b/);
    });
  });
});
