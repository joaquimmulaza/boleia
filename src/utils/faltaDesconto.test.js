import { describe, it, expect } from 'vitest';
import { computeFaltaDesconto } from './faltaDesconto.js';

describe('computeFaltaDesconto', () => {
  it('30000 / 22 arredonda a 2 casas como SQL ROUND (= 1363.64)', () => {
    expect(computeFaltaDesconto(30000, 22)).toBe(1363.64);
  });

  it('divisão exacta mantém 2 casas', () => {
    expect(computeFaltaDesconto(22000, 22)).toBe(1000);
  });

  it('arredonda half-up no segundo decimal (equivalente Math.round)', () => {
    // 10000 / 3 = 3333.333… → 3333.33
    expect(computeFaltaDesconto(10000, 3)).toBe(3333.33);
  });
});
