import { describe, it, expect } from 'vitest';
import {
  computeExcessoReembolsoKz,
  valorPagoEfectivoKz,
  formatAcordoIdCurto,
} from './adminResolucaoPagamento.js';

describe('adminResolucaoPagamento', () => {
  it('valorPagoEfectivoKz em custódia prefere valor_pago_confirmado_kz', () => {
    expect(
      valorPagoEfectivoKz({
        estado: 'em_custodia',
        valor_pago_confirmado_kz: 22000,
        valor_quota_original_kz: 22000,
        valor_kz: 15000,
      }),
    ).toBe(22000);
  });

  it('excesso = pago − valor_devido_kz (devido é quota proporcional, não reembolso)', () => {
    const pagamento = {
      estado: 'em_custodia',
      valor_kz: 22000,
      valor_pago_confirmado_kz: 22000,
      valor_devido_kz: 11000,
    };
    expect(computeExcessoReembolsoKz(pagamento)).toBe(11000);
    expect(computeExcessoReembolsoKz(pagamento)).not.toBe(pagamento.valor_kz);
  });

  it('caso divergente: pago 22000 e devido 8000 → excesso 14000 (não 8000)', () => {
    expect(
      computeExcessoReembolsoKz({
        estado: 'liquidado',
        valor_pago_confirmado_kz: 22000,
        valor_devido_kz: 8000,
      }),
    ).toBe(14000);
  });

  it('nunca devolve excesso negativo quando pago < devido', () => {
    expect(
      computeExcessoReembolsoKz({
        estado: 'em_custodia',
        valor_pago_confirmado_kz: 5000,
        valor_devido_kz: 11000,
      }),
    ).toBe(0);
  });

  it('formatAcordoIdCurto trunca UUID para 8 caracteres', () => {
    expect(formatAcordoIdCurto('79687aac-b123-4567-89ab-cdef01234567')).toBe('79687aac');
  });
});
