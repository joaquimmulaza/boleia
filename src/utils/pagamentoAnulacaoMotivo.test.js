import { describe, it, expect } from 'vitest';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import {
  isAnulacaoPorSaidaAntesActivacao,
  isAnulacaoReservaExpiradaPorPagamento,
} from './pagamentoAnulacaoMotivo.js';

describe('pagamentoAnulacaoMotivo', () => {
  it('detecta saída antes da activação (literal exacto)', () => {
    expect(
      isAnulacaoPorSaidaAntesActivacao({
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
      }),
    ).toBe(true);
  });

  it('acordo terminado antes da activação não conta como saída voluntária do passageiro', () => {
    expect(
      isAnulacaoPorSaidaAntesActivacao({
        anulacao_motivo: ANULACAO_MOTIVO.ACORDO_TERMINADO_ANTES_ACTIVACAO,
      }),
    ).toBe(false);
  });

  it('expiração TTL — literais exactos e legacy vazio', () => {
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: ANULACAO_MOTIVO.RESERVA_TERMINADA_SEM_ACTIVACAO,
      }),
    ).toBe(true);
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO,
      }),
    ).toBe(true);
    expect(isAnulacaoReservaExpiradaPorPagamento({ anulacao_motivo: null })).toBe(true);
    expect(isAnulacaoReservaExpiradaPorPagamento({ anulacao_motivo: '' })).toBe(true);
  });

  it('não trata saída, acordo terminado ou texto desconhecido como expiração', () => {
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
      }),
    ).toBe(false);
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: ANULACAO_MOTIVO.ACORDO_TERMINADO_ANTES_ACTIVACAO,
      }),
    ).toBe(false);
    expect(
      isAnulacaoReservaExpiradaPorPagamento({
        anulacao_motivo: 'Motivo inventado pelo admin',
      }),
    ).toBe(false);
  });
});
