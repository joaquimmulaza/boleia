import { describe, it, expect } from 'vitest';
import { isPropostaAcimaDoTeto } from './isPropostaAcimaDoTeto.js';

describe('isPropostaAcimaDoTeto', () => {
  it('sem teto ou teto ≤ 0 → false', () => {
    const prop = { modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 80000, n_passageiros_propostos: 1 };
    expect(isPropostaAcimaDoTeto(prop, null, 'POR_PASSAGEIRO')).toBe(false);
    expect(isPropostaAcimaDoTeto(prop, 0, 'POR_PASSAGEIRO')).toBe(false);
  });

  it('POR_PASSAGEIRO: ask acima do teto', () => {
    const prop = { modo_preco: 'POR_PASSAGEIRO', valor_mensal_ask_kz: 25000, n_passageiros_propostos: 1 };
    expect(isPropostaAcimaDoTeto(prop, 18000, 'POR_PASSAGEIRO')).toBe(true);
    expect(isPropostaAcimaDoTeto(prop, 25000, 'POR_PASSAGEIRO')).toBe(false);
  });

  it('TOTAL_ACORDO: compara o total resolvido com o teto', () => {
    const prop = { modo_preco: 'TOTAL_ACORDO', valor_mensal_ask_kz: 25000, n_passageiros_propostos: 2 };
    expect(isPropostaAcimaDoTeto(prop, 18000, 'TOTAL_ACORDO')).toBe(true);
    expect(isPropostaAcimaDoTeto(prop, 30000, 'TOTAL_ACORDO')).toBe(false);
  });
});
