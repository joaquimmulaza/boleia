import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  PROPOSTA_PRECO_DIA_LIMITE,
  getLuandaDayOfMonth,
  isJanelaPropostaPrecoAberta,
  copyBadgeJanelaAberta,
  copyBadgeJanelaFechada,
  formatEffectiveFromLongPt,
} from './precoProximoMes.js';
import { firstDayNextMonthLuanda } from './adendaEffectiveFrom.js';

describe('precoProximoMes — janela até dia 28', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dia limite canónico é 28', () => {
    expect(PROPOSTA_PRECO_DIA_LIMITE).toBe(28);
  });

  it('janela aberta no dia 28 inclusive', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00.000Z'));
    expect(getLuandaDayOfMonth()).toBe(28);
    expect(isJanelaPropostaPrecoAberta()).toBe(true);
    expect(copyBadgeJanelaAberta('Outubro')).toMatch(/dia 28/);
  });

  it('janela fechada após dia 28', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-29T12:00:00.000Z'));
    expect(isJanelaPropostaPrecoAberta()).toBe(false);
    expect(copyBadgeJanelaFechada()).toBe('Janela de propostas fechada');
  });

  it('formatEffectiveFromLongPt — dia 1 mês seguinte', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'));
    const next = firstDayNextMonthLuanda();
    expect(formatEffectiveFromLongPt(next)).toMatch(/1 de Novembro/i);
  });
});
