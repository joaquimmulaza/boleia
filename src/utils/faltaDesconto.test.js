import { describe, it, expect } from 'vitest';
import { computeFaltaDesconto, computeFaltaDescontoForIsoDate } from './faltaDesconto.js';

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

  it('ForIsoDate: dia 1 do mês usa o mês civil (nov=21, dez=23 Seg–Sex)', () => {
    expect(computeFaltaDescontoForIsoDate(22000, '2026-11-01', [1, 2, 3, 4, 5], 'ambas')).toBe(1047.62);
    expect(computeFaltaDescontoForIsoDate(22000, '2026-12-01', [1, 2, 3, 4, 5], 'ambas')).toBe(956.52);
  });

  it('ForIsoDate: Ter–Sex out vs nov 2026 usam divisores diferentes', () => {
    const out = computeFaltaDescontoForIsoDate(22000, '2026-10-14', [2, 3, 4, 5], 'ambas');
    const nov = computeFaltaDescontoForIsoDate(22000, '2026-11-11', [2, 3, 4, 5], 'ambas');
    expect(out).toBe(1222.22);
    expect(nov).toBe(1375);
    expect(out).not.toBe(nov);
  });
});
