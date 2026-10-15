import { describe, it, expect } from 'vitest';
import {
  countDiasViagemMes,
  isoDowFromIsoDate,
  isDataDiaViagemAcordo,
  jsDayToIsoDow,
  normalizeDiasSemanaAcordo,
} from './faltasDiasAcordo.js';

describe('faltasDiasAcordo — convenção 1=Seg … 7=Dom', () => {
  it('2026-10-04 é domingo ISO (7); getDay 0 converte para 7', () => {
    expect(isoDowFromIsoDate('2026-10-04')).toBe(7);
    expect(jsDayToIsoDow(0)).toBe(7);
    expect(isDataDiaViagemAcordo('2026-10-04', [1, 2, 3, 4, 5])).toBe(false);
  });

  it('2026-10-05 é segunda-feira ISO (1)', () => {
    expect(isoDowFromIsoDate('2026-10-05')).toBe(1);
    expect(jsDayToIsoDow(1)).toBe(1);
    expect(isDataDiaViagemAcordo('2026-10-05', [1, 2, 3, 4, 5])).toBe(true);
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

  it('novembro 2026 Ter–Sex tem 16 dias de viagem', () => {
    expect(countDiasViagemMes('2026-11-01', [2, 3, 4, 5])).toBe(16);
  });

  it('Seg–Sex: out/2026=22, nov/2026=21; NULL faz fallback Seg–Sex', () => {
    expect(countDiasViagemMes('2026-10-01', [1, 2, 3, 4, 5])).toBe(22);
    expect(countDiasViagemMes('2026-11-01', [1, 2, 3, 4, 5])).toBe(21);
    expect(countDiasViagemMes('2026-11-01', null)).toBe(21);
  });
});
