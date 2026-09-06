import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  firstDayNextMonthLuanda,
  firstDayCurrentMonthLuanda,
  isAdendaBeforeEffectiveFrom,
} from './adendaEffectiveFrom.js';

describe('adendaEffectiveFrom', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('firstDayCurrentMonthLuanda — mês corrente Luanda', () => {
    it('devolve 1.º dia do mês em Africa/Luanda', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
      expect(firstDayCurrentMonthLuanda()).toBe('2026-09-01');
    });
  });

  describe('firstDayNextMonthLuanda — viragem de mês', () => {
    it('último dia do mês → effective_from dia 1 do mês seguinte', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-31T22:00:00.000Z')); // 31 Ago 23:00 WAT
      expect(firstDayNextMonthLuanda()).toBe('2026-09-01');
    });

    it('primeiro dia do mês → effective_from dia 1 do mês seguinte', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-01T00:30:00.000Z')); // 01 Set 01:30 WAT
      expect(firstDayNextMonthLuanda()).toBe('2026-10-01');
    });

    it('dezembro → janeiro do ano seguinte', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-15T12:00:00.000Z'));
      expect(firstDayNextMonthLuanda()).toBe('2027-01-01');
    });
  });

  describe('isAdendaBeforeEffectiveFrom', () => {
    it('mês corrente antes de effective_from — live intacto', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
      expect(isAdendaBeforeEffectiveFrom('2026-10-01')).toBe(true);
    });

    it('no dia effective_from — já pode aplicar', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-01T08:00:00.000Z'));
      expect(isAdendaBeforeEffectiveFrom('2026-10-01')).toBe(false);
    });
  });
});
