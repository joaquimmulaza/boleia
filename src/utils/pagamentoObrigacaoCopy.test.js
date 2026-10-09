import { describe, it, expect } from 'vitest';
import {
  linhaProporcionalPagamento,
  linhaPrazoPagamento,
  tituloHistoricoPagamento,
  valorHistoricoPagamento,
} from './pagamentoObrigacaoCopy.js';

describe('pagamentoObrigacaoCopy — v1.4 / v1.5', () => {
  it('linhaProporcionalPagamento formata dias, proporcional, pago e a pagar sem calcular', () => {
    const line = linhaProporcionalPagamento({
      dias: 8,
      dias_mes: 22,
      mes: '2026-10-01',
      proporcional: 15636,
      pago: 0,
      valor: 15636,
    });
    expect(line).toMatch(/8 de 22 dias úteis/);
    expect(line).toMatch(/Proporcional/);
    expect(line).toMatch(/15[\s\u00a0]?636/);
    expect(line).toMatch(/A pagar/);
  });

  it('linhaPrazoPagamento devolve texto legível ou null', () => {
    expect(linhaPrazoPagamento(null)).toBeNull();
    const txt = linhaPrazoPagamento('2026-10-12T15:00:00.000Z');
    expect(txt).toMatch(/^Prazo:/);
  });

  it('tituloHistoricoPagamento inclui mês', () => {
    expect(tituloHistoricoPagamento('2026-10-01')).toMatch(/Pagamento de/);
  });

  it('valorHistoricoPagamento marca anulado para riscar no histórico', () => {
    const v = valorHistoricoPagamento(
      { estado: 'anulado', valor_kz: 0, valor_quota_original_kz: 43000 },
      { valor: 0 },
    );
    expect(v.anulado).toBe(true);
    expect(v.texto).toMatch(/43[\s\u00a0]?000/);
  });
});
