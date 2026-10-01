import { describe, it, expect } from 'vitest';
import {
  filterFaltasEsteMes,
  sumDescontoFaltas,
  todayLuandaISO,
  isFutureFaltaDate,
} from './faltasDisplay';

describe('faltasDisplay', () => {
  const refOct1 = new Date('2026-10-01T12:00:00Z');

  it('filtra faltas do mês corrente em Luanda até hoje (exclui futuras)', () => {
    const faltas = [
      { id: '1', data_falta: '2026-09-30', desconto_kz: 100 },
      { id: '2', data_falta: '2026-10-01', desconto_kz: 200 },
      { id: '3', data_falta: '2026-10-15', desconto_kz: 1272.73 },
      { id: '4', data_falta: '2026-11-01', desconto_kz: 50 },
    ];

    const esteMes = filterFaltasEsteMes(faltas, refOct1);

    expect(esteMes.map((f) => f.id)).toEqual(['2']);
  });

  it('soma descontos como valores positivos', () => {
    const total = sumDescontoFaltas([
      { desconto_kz: 1272.73 },
      { desconto_kz: 636.36 },
    ]);

    expect(total).toBeCloseTo(1909.09, 2);
  });

  it('devolve hoje em Luanda (YYYY-MM-DD)', () => {
    expect(todayLuandaISO(refOct1)).toBe('2026-10-01');
  });

  it('identifica datas futuras em Luanda', () => {
    expect(isFutureFaltaDate('2026-10-15', refOct1)).toBe(true);
    expect(isFutureFaltaDate('2026-10-01', refOct1)).toBe(false);
    expect(isFutureFaltaDate('2026-09-30', refOct1)).toBe(false);
  });
});
