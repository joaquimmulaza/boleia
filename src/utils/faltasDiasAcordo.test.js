import { describe, it, expect } from 'vitest';
import {
  countDiasViagemMes,
  isoDowFromIsoDate,
  isDataDiaViagemAcordo,
  normalizeDiasSemanaAcordo,
} from './faltasDiasAcordo.js';

describe('faltasDiasAcordo — convenção 1=Seg … 7=Dom', () => {
  it('2026-10-05 é segunda-feira (1)', () => {
    expect(isoDowFromIsoDate('2026-10-05')).toBe(1);
  });

  it('2026-10-10 é sábado (6)', () => {
    expect(isoDowFromIsoDate('2026-10-10')).toBe(6);
  });

  it('normaliza vazio para Seg–Sex', () => {
    expect(normalizeDiasSemanaAcordo(null)).toEqual([1, 2, 3, 4, 5]);
    expect(normalizeDiasSemanaAcordo([])).toEqual([1, 2, 3, 4, 5]);
  });

  it('rejeita segunda com oferta Ter–Sex', () => {
    expect(isDataDiaViagemAcordo('2026-10-05', [2, 3, 4, 5])).toBe(false);
    expect(isDataDiaViagemAcordo('2026-10-06', [2, 3, 4, 5])).toBe(true);
  });

  it('outubro 2026 Ter–Sex tem 18 dias de viagem', () => {
    expect(countDiasViagemMes('2026-10-01', [2, 3, 4, 5])).toBe(18);
  });
});
