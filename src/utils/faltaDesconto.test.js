import { describe, it, expect } from 'vitest';
import { computeFaltaDesconto } from './faltaDesconto.js';

describe('computeFaltaDesconto — meia quota', () => {
  it('ambas: 30000 / 22 arredonda a 2 casas como SQL ROUND (= 1363.64)', () => {
    expect(computeFaltaDesconto(30000, 22)).toBe(1363.64);
    expect(computeFaltaDesconto(30000, 22, 'ambas')).toBe(1363.64);
  });

  it('ida ou regresso: metade do dia (meia quota)', () => {
    expect(computeFaltaDesconto(30000, 22, 'ida')).toBe(681.82);
    expect(computeFaltaDesconto(30000, 22, 'regresso')).toBe(681.82);
  });

  it('divisão exacta mantém 2 casas', () => {
    expect(computeFaltaDesconto(22000, 22, 'ambas')).toBe(1000);
    expect(computeFaltaDesconto(22000, 22, 'ida')).toBe(500);
  });

  it('arredonda half-up no segundo decimal (equivalente Math.round)', () => {
    expect(computeFaltaDesconto(10000, 3, 'ambas')).toBe(3333.33);
  });

  it('rejeita viagem inválida', () => {
    expect(() => computeFaltaDesconto(30000, 22, 'meio-dia')).toThrow(/Viagem inválida/i);
  });
});
