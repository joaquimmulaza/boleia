import { describe, it, expect } from 'vitest';
import { resolveAgreementPricing } from './resolveAgreementPricing';

describe('resolveAgreementPricing', () => {
  it('POR_PASSAGEIRO: total = individual × N e quotas iguais', () => {
    const result = resolveAgreementPricing({
      modo_preco: 'POR_PASSAGEIRO',
      valor_ask_kz: 40000,
      n_passageiros: 3,
    });

    expect(result.valor_mensal_por_passageiro_kz).toBe(40000);
    expect(result.valor_mensal_total_kz).toBe(120000);
    expect(result.quotas).toEqual([40000, 40000, 40000]);
  });

  it('TOTAL_ACORDO: divisão exacta — quotas iguais a base', () => {
    const result = resolveAgreementPricing({
      modo_preco: 'TOTAL_ACORDO',
      valor_ask_kz: 120000,
      n_passageiros: 4,
    });

    expect(result.valor_mensal_total_kz).toBe(120000);
    expect(result.valor_mensal_por_passageiro_kz).toBe(30000);
    expect(result.quotas).toEqual([30000, 30000, 30000, 30000]);
    expect(result.quotas.reduce((a, b) => a + b, 0)).toBe(120000);
  });

  it('TOTAL_ACORDO: resto — primeiros resto passageiros recebem base+1', () => {
    const result = resolveAgreementPricing({
      modo_preco: 'TOTAL_ACORDO',
      valor_ask_kz: 100000,
      n_passageiros: 3,
    });

    expect(result.valor_mensal_total_kz).toBe(100000);
    expect(result.valor_mensal_por_passageiro_kz).toBe(33333);
    expect(result.quotas).toEqual([33334, 33333, 33333]);
    expect(result.quotas.reduce((a, b) => a + b, 0)).toBe(100000);
  });

  it('TOTAL_ACORDO: resto=2 — dois primeiros com base+1', () => {
    const result = resolveAgreementPricing({
      modo_preco: 'TOTAL_ACORDO',
      valor_ask_kz: 100001,
      n_passageiros: 3,
    });

    expect(result.valor_mensal_por_passageiro_kz).toBe(33333);
    expect(result.quotas).toEqual([33334, 33334, 33333]);
    expect(result.quotas.reduce((a, b) => a + b, 0)).toBe(100001);
  });

  it('N=1 funciona nos dois modos', () => {
    expect(
      resolveAgreementPricing({
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 40000,
        n_passageiros: 1,
      }).quotas,
    ).toEqual([40000]);

    expect(
      resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 40000,
        n_passageiros: 1,
      }).quotas,
    ).toEqual([40000]);
  });

  it('rejeita N inválido ou modo desconhecido', () => {
    expect(() =>
      resolveAgreementPricing({
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 40000,
        n_passageiros: 0,
      }),
    ).toThrow();

    expect(() =>
      resolveAgreementPricing({
        modo_preco: 'OUTRO',
        valor_ask_kz: 40000,
        n_passageiros: 2,
      }),
    ).toThrow();
  });

  it('exige valores inteiros em Kz (sem decimais)', () => {
    expect(() =>
      resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 100000.5,
        n_passageiros: 3,
      }),
    ).toThrow();
  });
});
