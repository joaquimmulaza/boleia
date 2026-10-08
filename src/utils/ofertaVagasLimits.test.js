import { describe, it, expect } from 'vitest';
import { computeOfertaVagasLimits } from './ofertaVagasLimits';

describe('computeOfertaVagasLimits', () => {
  it('min = lugares ocupados, max = vagas_passageiros do veículo', () => {
    const limits = computeOfertaVagasLimits(
      { vagas_totais: 4, vagas_disponiveis: 1 },
      6,
    );
    expect(limits.ocupadas).toBe(3);
    expect(limits.min).toBe(3);
    expect(limits.max).toBe(6);
    expect(limits.actual).toBe(4);
  });

  it('sem ocupação, min é 1', () => {
    const limits = computeOfertaVagasLimits(
      { vagas_totais: 3, vagas_disponiveis: 3 },
      5,
    );
    expect(limits.min).toBe(1);
    expect(limits.max).toBe(5);
  });
});
