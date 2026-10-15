import { describe, it, expect } from 'vitest';
import { runAcordoDetalheFetches, estimateDetalheLoadMs } from './runAcordoDetalheFetches.js';

describe('runAcordoDetalheFetches', () => {
  it('inicia todos os pedidos antes do primeiro resolver', async () => {
    /** @type {string[]} */
    const order = [];

    const lag = (name, value) =>
      new Promise((resolve) => {
        order.push(`start:${name}`);
        setTimeout(() => {
          order.push(`end:${name}`);
          resolve(value);
        }, 30);
      });

    await runAcordoDetalheFetches({
      listPagamentosByAcordo: () => lag('pagamentos', []),
      listPagamentosPendentesMotorista: () => lag('motorista', []),
      getAcordoContactos: () => lag('contactos', {}),
      listMinhasAvaliacoesAcordo: () => lag('avaliacoes', []),
      listAdendaHistorico: () => lag('historico', []),
    });

    const starts = order.filter((e) => e.startsWith('start:'));
    expect(starts).toHaveLength(5);
    const firstEnd = order.findIndex((e) => e.startsWith('end:'));
    expect(firstEnd).toBeGreaterThanOrEqual(5);
  });

  it('estimateDetalheLoadMs — 5 pedidos × 150ms', () => {
    const { sequentialMs, parallelMs } = estimateDetalheLoadMs(150, 5);
    expect(sequentialMs).toBe(750);
    expect(parallelMs).toBe(150);
  });
});
