import { describe, it, expect } from 'vitest';
import {
  acordoTemRescisaoConsensualPendenteParaUser,
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

  it('acordoTemRescisaoConsensualPendenteParaUser só para contraparte com pedido activo', () => {
    const acordo = {
      estado: 'activo',
      rescisao_modo: 'consensual',
      rescisao_solicitada_por: 'driver-1',
    };
    expect(acordoTemRescisaoConsensualPendenteParaUser(acordo, 'pax-1')).toBe(true);
    expect(acordoTemRescisaoConsensualPendenteParaUser(acordo, 'driver-1')).toBe(false);
    expect(
      acordoTemRescisaoConsensualPendenteParaUser(
        { ...acordo, estado: 'cancelamento_pendente' },
        'pax-1',
      ),
    ).toBe(false);
    expect(
      acordoTemRescisaoConsensualPendenteParaUser(
        { ...acordo, rescisao_modo: null, rescisao_solicitada_por: null },
        'pax-1',
      ),
    ).toBe(false);
  });

  it('copyCancelamentoPendente inclui data e efeito na vaga', () => {
    const copy = copyCancelamentoPendente('2026-10-01');
    expect(copy?.titulo).toMatch(/cancelamento pendente/i);
    expect(copy?.corpo).toMatch(/30 de setembro de 2026/i);
    expect(copy?.corpo).toMatch(/vaga permanece ocupada/i);
    expect(copy?.corpo).toMatch(/quotas congeladas/i);
  });
});
