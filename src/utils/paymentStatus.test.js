import { describe, it, expect } from 'vitest';
import {
  PAYMENT_STATES,
  TAKE_RATE_PCT,
  allowsContactReveal,
  canTransitionPayment,
  computePayoutLiquidoKz,
  labelEstadoPagamento,
} from './paymentStatus.js';

describe('paymentStatus — máquina de estados PACOTE ENG #5', () => {
  it('define os cinco estados obrigatórios', () => {
    expect(Object.values(PAYMENT_STATES).sort()).toEqual(
      [
        'comprovativo_enviado',
        'em_custodia',
        'liquidado',
        'pendente_pagamento',
        'reembolsado',
      ].sort(),
    );
  });

  it('take-rate documentado é ~10%', () => {
    expect(TAKE_RATE_PCT).toBe(0.1);
  });

  it('computePayoutLiquidoKz aplica take-rate sobre valor do acordo (sem defaults)', () => {
    expect(computePayoutLiquidoKz(43000)).toBe(38700);
    expect(computePayoutLiquidoKz(77000)).toBe(69300);
  });

  it('allowsContactReveal só após em_custodia (ou liquidado)', () => {
    expect(allowsContactReveal('pendente_pagamento')).toBe(false);
    expect(allowsContactReveal('comprovativo_enviado')).toBe(false);
    expect(allowsContactReveal('em_custodia')).toBe(true);
    expect(allowsContactReveal('liquidado')).toBe(true);
    expect(allowsContactReveal('reembolsado')).toBe(false);
  });

  it('canTransitionPayment valida transições permitidas', () => {
    expect(
      canTransitionPayment('pendente_pagamento', 'comprovativo_enviado'),
    ).toBe(true);
    expect(
      canTransitionPayment('comprovativo_enviado', 'em_custodia'),
    ).toBe(true);
    expect(
      canTransitionPayment('comprovativo_enviado', 'pendente_pagamento'),
    ).toBe(true);
    expect(
      canTransitionPayment('em_custodia', 'liquidado'),
    ).toBe(true);
    expect(
      canTransitionPayment('pendente_pagamento', 'em_custodia'),
    ).toBe(false);
  });

  it('labelEstadoPagamento devolve copy humana PT-PT', () => {
    expect(labelEstadoPagamento('pendente_pagamento')).toMatch(/pendente/i);
    expect(labelEstadoPagamento('em_custodia')).toMatch(/custódia/i);
  });
});
