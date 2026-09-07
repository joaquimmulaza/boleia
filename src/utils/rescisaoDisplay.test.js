import { describe, it, expect } from 'vitest';
import {
  formatDateLuandaPt,
  lastDayOfRescisaoCycle,
  copyCancelamentoPendente,
} from './rescisaoDisplay.js';

describe('rescisaoDisplay', () => {
  it('lastDayOfRescisaoCycle devolve último dia do mês anterior', () => {
    expect(lastDayOfRescisaoCycle('2026-10-01')).toBe('2026-09-30');
  });

  it('formatDateLuandaPt formata data legível', () => {
    expect(formatDateLuandaPt('2026-09-30')).toMatch(/30 de setembro de 2026/i);
  });

  it('copyCancelamentoPendente inclui data e efeito na vaga', () => {
    const copy = copyCancelamentoPendente('2026-10-01');
    expect(copy?.titulo).toMatch(/cancelamento pendente/i);
    expect(copy?.corpo).toMatch(/30 de setembro de 2026/i);
    expect(copy?.corpo).toMatch(/vaga permanece ocupada/i);
    expect(copy?.corpo).toMatch(/quotas congeladas/i);
  });
});
