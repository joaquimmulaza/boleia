import { describe, it, expect } from 'vitest';
import {
  PAYMENT_STATES,
  TAKE_RATE_PCT,
  allowsContactReveal,
  allowsAssiduidadeFaltas,
  allowsAssiduidadeFaltasForAcordo,
  canTransitionPayment,
  computePayoutLiquidoKz,
  computePlatformFeeKz,
  computeRepasseLiquidoKz,
  labelEstadoPagamento,
  helpEstadoPagamento,
  chipClassEstadoPagamento,
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

  it('computePlatformFeeKz retém ~10% do GMV', () => {
    expect(computePlatformFeeKz(43000)).toBe(4300);
    expect(computePlatformFeeKz(50000)).toBe(5000);
  });

  it('allowsContactReveal só após em_custodia (ou liquidado)', () => {
    expect(allowsContactReveal('pendente_pagamento')).toBe(false);
    expect(allowsContactReveal('comprovativo_enviado')).toBe(false);
    expect(allowsContactReveal('em_custodia')).toBe(true);
    expect(allowsContactReveal('liquidado')).toBe(true);
    expect(allowsContactReveal('reembolsado')).toBe(false);
  });

  it('allowsAssiduidadeFaltas exige em_custodia ou liquidado', () => {
    expect(allowsAssiduidadeFaltas('comprovativo_enviado')).toBe(false);
    expect(allowsAssiduidadeFaltas('em_custodia')).toBe(true);
    expect(allowsAssiduidadeFaltas('liquidado')).toBe(true);
  });

  it('allowsAssiduidadeFaltasForAcordo exige custódia para todos os passageiros activos', () => {
    const pagamentos = [
      { passenger_id: 'p1', estado: 'em_custodia' },
      { passenger_id: 'p2', estado: 'pendente_pagamento' },
    ];
    expect(allowsAssiduidadeFaltasForAcordo(pagamentos, ['p1'])).toBe(true);
    expect(allowsAssiduidadeFaltasForAcordo(pagamentos, ['p1', 'p2'])).toBe(false);
  });

  it('computeRepasseLiquidoKz subtrai faltas do payout sem ir abaixo de zero', () => {
    expect(computeRepasseLiquidoKz(45000, 1363.64)).toBe(43636);
    expect(computeRepasseLiquidoKz(45000, 50000)).toBe(0);
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

  it('helpEstadoPagamento glossário para custódia e liquidado', () => {
    expect(helpEstadoPagamento('em_custodia')).toMatch(/plataforma/i);
    expect(helpEstadoPagamento('liquidado')).toMatch(/motorista/i);
  });

  it('chipClassEstadoPagamento devolve classes por estado', () => {
    expect(chipClassEstadoPagamento('em_custodia')).toMatch(/sky/);
    expect(chipClassEstadoPagamento('liquidado')).toMatch(/emerald/);
  });
});
