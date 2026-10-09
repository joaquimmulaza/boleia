import { describe, it, expect } from 'vitest';
import {
  isAnulacaoPorSaidaAntesActivacao,
  isAnulacaoReservaExpiradaPorPagamento,
} from './pagamentoAnulacaoMotivo.js';

describe('pagamentoAnulacaoMotivo', () => {
  it('detecta saída antes da activação', () => {
    expect(
      isAnulacaoPorSaidaAntesActivacao({
        anulacao_motivo: 'Saíste antes da activação do lugar',
      }),
    ).toBe(true);
  });

  it('detecta expiração por falta de pagamento', () => {
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: 'Reserva terminada sem activação',
      }),
    ).toBe(true);
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: 'Saíste antes da activação do lugar',
      }),
    ).toBe(false);
  });
});
