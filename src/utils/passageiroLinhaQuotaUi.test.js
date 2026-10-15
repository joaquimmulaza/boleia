import { describe, it, expect } from 'vitest';
import { resolveQuotaLinhaPassageiroUi, QUOTA_LINHA_ANULADO } from './passageiroLinhaQuotaUi.js';
import { ANULACAO_MOTIVO } from '../constants/anulacaoMotivos.js';

describe('resolveQuotaLinhaPassageiroUi — #269 reserva expirada', () => {
  it('FAIL-on-old: expirado TTL não mostra quota congelada', () => {
    const r = resolveQuotaLinhaPassageiroUi(
      { estado: 'expirado', quota_mensal_kz: 25000 },
      { estado: 'anulado', anulacao_motivo: ANULACAO_MOTIVO.PRAZO_RESERVA_EXPIRADO },
    );
    expect(r.kind).not.toBe('quota');
    expect(r).toEqual({ kind: 'text', text: QUOTA_LINHA_ANULADO });
  });

  it('expirado sem pagamento anulado — oculta valor', () => {
    expect(
      resolveQuotaLinhaPassageiroUi(
        { estado: 'expirado', quota_mensal_kz: 25000 },
        null,
      ),
    ).toEqual({ kind: 'hidden' });
  });

  it('activo mantém quota', () => {
    expect(
      resolveQuotaLinhaPassageiroUi({ estado: 'activo', quota_mensal_kz: 25000 }, null),
    ).toEqual({ kind: 'quota', kz: 25000 });
  });
});
