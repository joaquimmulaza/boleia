import { describe, it, expect } from 'vitest';
import {
  linhaProporcionalPagamento,
  mostrarDesagregacaoProporcionalPagamento,
  linhaValorAPagarResumo,
  linhaPrazoPagamento,
  tituloHistoricoPagamento,
  valorHistoricoPagamento,
  normalizeObrigacaoSnapshot,
  linhaSecundariaExcessoPassageiro,
  labelEstadoPagamentoPassageiro,
  mostrarIconeSucessoPagamento,
  tituloSecaoPagamentosMotorista,
  valorEmDividaParaExibir,
  isDestaqueValorEmDividaSaiuPendente,
} from './pagamentoObrigacaoCopy.js';

describe('pagamentoObrigacaoCopy — v1.4 / v1.5', () => {
  it('linhaProporcionalPagamento formata dias, proporcional, pago e a pagar sem calcular', () => {
    const obrigacao = normalizeObrigacaoSnapshot({
      dias: 8,
      dias_mes: 22,
      mes: '2026-10-01',
      quota: 43000,
      proporcional: 15636,
      pago: 0,
      valor: 15636,
    });
    const line = linhaProporcionalPagamento(obrigacao);
    expect(line).toMatch(/8 de 22 dias úteis/);
    expect(line).toMatch(/Proporcional/);
    expect(line).toMatch(/15[\s\u00a0]?636/);
    expect(line).toMatch(/A pagar/);
    expect(line).not.toMatch(/43[\s\u00a0]?000/);
  });

  it('linhaPrazoPagamento devolve «até {data}» ou null', () => {
    expect(linhaPrazoPagamento(null)).toBeNull();
    const txt = linhaPrazoPagamento('2026-10-12T15:00:00.000Z');
    expect(txt).toMatch(/^até /);
    expect(txt).not.toMatch(/Prazo:/);
  });

  it('tituloHistoricoPagamento inclui mês', () => {
    expect(tituloHistoricoPagamento('2026-10-01')).toMatch(/Pagamento de/);
  });

  it('valorHistoricoPagamento marca anulado para riscar no histórico', () => {
    const obrigacao = normalizeObrigacaoSnapshot({ valor: 0, valor_em_divida: 0 });
    const v = valorHistoricoPagamento(
      { estado: 'anulado', valor_kz: 0, valor_quota_original_kz: 43000 },
      obrigacao,
    );
    expect(v.anulado).toBe(true);
    expect(v.texto).toMatch(/43[\s\u00a0]?000/);
  });
});

describe('pagamentoObrigacaoCopy — v1.6', () => {
  it('normalizeObrigacaoSnapshot separa quota e valor_em_divida', () => {
    const n = normalizeObrigacaoSnapshot({
      quota: 43000,
      valor: 12000,
      proporcional: 15000,
    });
    expect(n.quota).toBe(43000);
    expect(n.valor_em_divida).toBe(12000);
    expect(n.proporcional).toBe(15000);
  });

  it('excesso: label Diferença em análise e linha secundária com devido proporcional', () => {
    const obrigacao = normalizeObrigacaoSnapshot({
      dias: 5,
      dias_mes: 22,
      mes: '2026-10-01',
      proporcional: 9773,
      pago: 12000,
      valor_em_divida: 0,
      quota: 43000,
    });
    expect(
      labelEstadoPagamentoPassageiro(
        { estado: 'em_custodia', requer_resolucao_admin: true },
        obrigacao,
      ),
    ).toBe('Diferença em análise');
    const sec = linhaSecundariaExcessoPassageiro(obrigacao);
    expect(sec).toMatch(/Os 9[\s\u00a0]?773 Kz correspondem a 5 de 22 dias úteis/);
  });

  it('mostrarIconeSucessoPagamento — sem check com dívida, expirado ou excesso', () => {
    const comDivida = normalizeObrigacaoSnapshot({ valor_em_divida: 100 });
    expect(
      mostrarIconeSucessoPagamento({
        pagamento: { estado: 'pendente_pagamento' },
        obrigacao: comDivida,
        lugarEstado: 'activo',
      }),
    ).toBe(false);
    expect(
      mostrarIconeSucessoPagamento({
        pagamento: { estado: 'anulado' },
        obrigacao: null,
        lugarEstado: 'expirado',
      }),
    ).toBe(false);
    expect(
      mostrarIconeSucessoPagamento({
        pagamento: { estado: 'em_custodia', requer_resolucao_admin: true },
        obrigacao: normalizeObrigacaoSnapshot({ valor_em_divida: 0 }),
        lugarEstado: 'saiu',
      }),
    ).toBe(false);
    expect(
      mostrarIconeSucessoPagamento({
        pagamento: { estado: 'em_custodia' },
        obrigacao: normalizeObrigacaoSnapshot({ valor_em_divida: 0 }),
        lugarEstado: 'activo',
      }),
    ).toBe(true);
  });

  it('tituloSecaoPagamentosMotorista após rescisão', () => {
    expect(tituloSecaoPagamentosMotorista({ acordoTerminado: true, multipleSections: false }))
      .toBe('Pagamentos');
    expect(tituloSecaoPagamentosMotorista({ acordoTerminado: true, multipleSections: true }))
      .toBe('Pagamentos deste acordo');
    expect(tituloSecaoPagamentosMotorista({ acordoTerminado: false, multipleSections: false }))
      .toBe('Pagamentos do mês');
  });

  it('valorEmDividaParaExibir nunca usa quota', () => {
    const obrigacao = normalizeObrigacaoSnapshot({ quota: 43000, valor_em_divida: 8000 });
    expect(valorEmDividaParaExibir(obrigacao, { valor_kz: 43000 })).toBe(8000);
  });

  it('mostrarDesagregacaoProporcionalPagamento só em saída/rescisão', () => {
    expect(mostrarDesagregacaoProporcionalPagamento('activo', null)).toBe(false);
    expect(mostrarDesagregacaoProporcionalPagamento('reservado', null)).toBe(false);
    expect(mostrarDesagregacaoProporcionalPagamento('saiu', null)).toBe(true);
    expect(mostrarDesagregacaoProporcionalPagamento('activo', 'S2')).toBe(true);
  });

  it('linhaValorAPagarResumo no acordo activo', () => {
    const obrigacao = normalizeObrigacaoSnapshot({ valor_em_divida: 16000, quota: 16000 });
    expect(linhaValorAPagarResumo(obrigacao, { valor_kz: 16000 })).toBe('Valor a pagar: 16\u00a0000 Kz');
  });

  it('linhaProporcionalPagamento — comprovativo em validação em vez de Já pago', () => {
    const obrigacao = normalizeObrigacaoSnapshot({
      dias: 7,
      dias_mes: 22,
      mes: '2026-10-01',
      proporcional: 16000,
      pago: 0,
      valor_em_divida: 16000,
    });
    const line = linhaProporcionalPagamento(obrigacao, {
      pagamentoEstado: 'comprovativo_enviado',
      valorComprovativo: 16000,
    });
    expect(line).toMatch(/comprovativo de 16[\s\u00a0]?000 Kz em validação/i);
    expect(line).not.toMatch(/Já pago/);
  });

  it('isDestaqueValorEmDividaSaiuPendente só saiu com pagamento em aberto', () => {
    expect(
      isDestaqueValorEmDividaSaiuPendente('saiu', { estado: 'pendente_pagamento' }),
    ).toBe(true);
    expect(
      isDestaqueValorEmDividaSaiuPendente('activo', { estado: 'pendente_pagamento' }),
    ).toBe(false);
    expect(
      isDestaqueValorEmDividaSaiuPendente('saiu', { estado: 'liquidado' }),
    ).toBe(false);
  });
});
