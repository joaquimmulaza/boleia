import { describe, it, expect } from 'vitest';
import { resolvePassageiroReservaPagamento } from './resolveAcordoPagamentoUi.js';

describe('resolvePassageiroReservaPagamento — fonte única banner vs painel', () => {
  const linhaReservada = { estado: 'reservado', passenger_id: 'pax-1' };

  it('reservado a carregar: sem banner CTA nem mensagem de indisponível', () => {
    const ui = resolvePassageiroReservaPagamento({
      minhaLinha: linhaReservada,
      pagamento: null,
      pagamentoLoading: true,
      obrigacao: { valor: 22000, valor_em_divida: 22000 },
    });
    expect(ui.mostrarBannerReserva).toBe(false);
    expect(ui.mostrarPainelPagamentoMensal).toBe(true);
    expect(ui.mostrarMensagemIndisponivel).toBe(false);
    expect(ui.aguardarCarregamentoPagamento).toBe(true);
  });

  it('reservado carregado sem registo pagamento: oculta banner e painel indisponível', () => {
    const ui = resolvePassageiroReservaPagamento({
      minhaLinha: linhaReservada,
      pagamento: null,
      pagamentoLoading: false,
      obrigacao: { valor: 22000, valor_em_divida: 22000 },
    });
    expect(ui.mostrarBannerReserva).toBe(false);
    expect(ui.mostrarPainelPagamentoMensal).toBe(false);
    expect(ui.mostrarMensagemIndisponivel).toBe(false);
  });

  it('reservado com pagamento pendente: banner e painel alinhados', () => {
    const pagamento = { id: 'pg-1', estado: 'pendente_pagamento', valor_kz: 22000 };
    const ui = resolvePassageiroReservaPagamento({
      minhaLinha: linhaReservada,
      pagamento,
      pagamentoLoading: false,
      obrigacao: { valor: 22000, valor_em_divida: 22000 },
    });
    expect(ui.mostrarBannerReserva).toBe(true);
    expect(ui.mostrarPainelPagamentoMensal).toBe(true);
    expect(ui.pagamentoParaPainel).toBe(pagamento);
  });
});
