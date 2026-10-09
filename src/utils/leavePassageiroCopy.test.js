import { describe, it, expect } from 'vitest';
import {
  copyConfirmacaoSaidaPassageiro,
  copyToastSaidaPassageiro,
  isLugarActivadoParaQuota,
  countLugaresVivosAcordo,
  isUltimoPassageiroVivoNoAcordo,
} from './leavePassageiroCopy.js';

describe('leavePassageiroCopy — saída antes vs depois da activação', () => {
  it('isLugarActivadoParaQuota só com activo', () => {
    expect(isLugarActivadoParaQuota('activo')).toBe(true);
    expect(isLugarActivadoParaQuota('reservado')).toBe(false);
    expect(isLugarActivadoParaQuota('saiu')).toBe(false);
  });

  it('countLugaresVivosAcordo — reservado e activo', () => {
    expect(
      countLugaresVivosAcordo([
        { estado: 'activo' },
        { estado: 'reservado' },
        { estado: 'saiu' },
      ]),
    ).toBe(2);
    expect(countLugaresVivosAcordo([{ estado: 'saiu' }])).toBe(0);
  });

  it('isUltimoPassageiroVivoNoAcordo quando só resta um lugar vivo', () => {
    expect(
      isUltimoPassageiroVivoNoAcordo([
        { passenger_id: 'p1', estado: 'activo' },
        { passenger_id: 'p2', estado: 'saiu' },
      ], 'p1'),
    ).toBe(true);
    expect(
      isUltimoPassageiroVivoNoAcordo([
        { passenger_id: 'p1', estado: 'activo' },
        { passenger_id: 'p2', estado: 'reservado' },
      ], 'p1'),
    ).toBe(false);
  });

  it('confirmação último passageiro vivo — encerra acordo', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        ultimoPassageiroVivo: true,
        lugarEstado: 'activo',
      }),
    ).toBe('És o último passageiro. Ao saíres, o acordo é encerrado.');
  });

  it('confirmação reservado enquanto pagamento carrega — neutro', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: null,
        pagamentoLoading: true,
      }),
    ).toMatch(/A confirmar o estado do pagamento/);
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: null,
        pagamentoLoading: true,
      }),
    ).not.toMatch(/Não tens nada a pagar/);
  });

  it('confirmação antes da activação sem pagamento em aberto', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({ lugarEstado: 'reservado', pagamento: null }),
    ).toMatch(/Não tens nada a pagar neste acordo/);
    expect(
      copyConfirmacaoSaidaPassageiro({ lugarEstado: 'reservado', pagamento: null }),
    ).not.toMatch(/quota deste mês não é reembolsada/);
  });

  it('confirmação antes da activação com comprovativo pendente', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: { estado: 'comprovativo_enviado' },
      }),
    ).toMatch(/pagamento pendente será cancelado\. Não tens nada a pagar\./);
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: { estado: 'comprovativo_enviado' },
      }),
    ).not.toMatch(/cancelado — não/);
  });

  it('confirmação após activação mantém regra de quota', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'activo',
        pagamento: { estado: 'em_custodia' },
      }),
    ).toBe(
      'Saída individual: o acordo mantém-se activo para os restantes. '
      + 'A tua quota deste mês não é reembolsada.',
    );
  });

  it('toast antes da activação — cancelamento de pagamento', () => {
    expect(
      copyToastSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: { estado: 'comprovativo_enviado' },
      }),
    ).toBe('Saíste do acordo. O pagamento pendente foi cancelado.');
  });

  it('toast após activação — quota ou proporcional', () => {
    expect(
      copyToastSaidaPassageiro({
        lugarEstado: 'activo',
        pagamento: { estado: 'em_custodia' },
        obrigacao: { valor_em_divida: 0 },
      }),
    ).toBe('Saíste do acordo. A quota do mês mantém-se.');
    expect(
      copyToastSaidaPassageiro({
        lugarEstado: 'activo',
        pagamento: { estado: 'pendente_pagamento', valor_kz: 8000 },
        obrigacao: { valor_em_divida: 8000 },
      }),
    ).toMatch(/quota proporcional.*8[\s\u00a0]?000/);
  });
});
