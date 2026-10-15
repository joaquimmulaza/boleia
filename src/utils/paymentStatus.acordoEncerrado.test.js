import { describe, it, expect } from 'vitest';
import {
  labelEstadoPagamentoMotoristaCabecalho,
  isAcordoEncerradoPagamentoUi,
} from './paymentStatus.js';

describe('paymentStatus — acordo encerrado prevalece', () => {
  it('isAcordoEncerradoPagamentoUi reconhece cancelado, justa causa e expirado', () => {
    expect(isAcordoEncerradoPagamentoUi('cancelado')).toBe(true);
    expect(isAcordoEncerradoPagamentoUi('cancelado_justificado')).toBe(true);
    expect(isAcordoEncerradoPagamentoUi('expirado')).toBe(true);
    expect(isAcordoEncerradoPagamentoUi('activo')).toBe(false);
    expect(isAcordoEncerradoPagamentoUi('cancelamento_pendente')).toBe(false);
  });

  it('acordo encerrado + pendente_pagamento: chip não é «Pagamento pendente»', () => {
    expect(
      labelEstadoPagamentoMotoristaCabecalho('pendente_pagamento', { acordoTerminado: true }),
    ).toBe('Pagamento cancelado');
    expect(
      labelEstadoPagamentoMotoristaCabecalho('pendente_pagamento', { acordoTerminado: true }),
    ).not.toMatch(/pendente/i);
  });

  it('acordo activo mantém «Pagamento pendente»', () => {
    expect(
      labelEstadoPagamentoMotoristaCabecalho('pendente_pagamento', { acordoTerminado: false }),
    ).toBe('Pagamento pendente');
  });
});
