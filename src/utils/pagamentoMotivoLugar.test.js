import { describe, it, expect } from 'vitest';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';
import {
  groupAnulacaoMotivoRowsByAcordo,
  mergePagamentoComChipContexto,
  resolvePagamentoChipContexto,
} from './pagamentoMotivoLugar.js';

describe('pagamentoMotivoLugar — chips por acordo', () => {
  it('groupAnulacaoMotivoRowsByAcordo indexa por passageiro', () => {
    const index = groupAnulacaoMotivoRowsByAcordo([
      {
        acordo_id: 'acordo-a',
        passenger_id: '7dad33e1',
        anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
        pagamento_estado: 'anulado',
      },
    ]);
    expect(index['acordo-a']['7dad33e1'].anulacao_motivo).toBe(
      ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
    );
  });

  it('mergePagamentoComChipContexto preenche motivo em falta (283be1da)', () => {
    const merged = mergePagamentoComChipContexto(
      { estado: 'anulado', valor_quota_original_kz: 16000 },
      { anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO, estado: 'anulado' },
    );
    expect(merged?.anulacao_motivo).toBe(ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO);
  });

  it('resolvePagamentoChipContexto prioriza chipFromList (motorista)', () => {
    const ctx = resolvePagamentoChipContexto(
      { passenger_id: '283be1da' },
      {
        chipFromList: {
          anulacao_motivo: ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO,
          estado: 'anulado',
        },
      },
    );
    expect(ctx?.anulacao_motivo).toBe(ANULACAO_MOTIVO.SAISTE_ANTES_ACTIVACAO);
  });
});
