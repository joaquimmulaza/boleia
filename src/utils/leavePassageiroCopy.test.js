import { describe, it, expect } from 'vitest';
import {
  copyConfirmacaoSaidaPassageiro,
  copyToastSaidaPassageiro,
  isLugarActivadoParaQuota,
} from './leavePassageiroCopy.js';

describe('leavePassageiroCopy — saída antes vs depois da activação', () => {
  it('isLugarActivadoParaQuota só com activo', () => {
    expect(isLugarActivadoParaQuota('activo')).toBe(true);
    expect(isLugarActivadoParaQuota('reservado')).toBe(false);
    expect(isLugarActivadoParaQuota('saiu')).toBe(false);
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

  it('último passageiro (activo): quota + linha PM, sem prefixo «mantém-se activo»', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'activo',
        pagamento: { estado: 'em_custodia' },
        lugaresVivosCount: 1,
        lugaresVivosLoading: false,
      }),
    ).toBe(
      'A tua quota deste mês não é reembolsada. '
      + 'És o último passageiro. Ao saíres, o acordo é encerrado.',
    );
  });

  it('último passageiro (reservado + comprovativo): cancelamento pagamento + linha PM', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: { estado: 'comprovativo_enviado' },
        lugaresVivosCount: 1,
        lugaresVivosLoading: false,
      }),
    ).toBe(
      'O teu pagamento pendente será cancelado. Não tens nada a pagar. '
      + 'És o último passageiro. Ao saíres, o acordo é encerrado.',
    );
  });

  it('último passageiro (reservado + pendente_pagamento): mesma linha de pagamento + PM', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: { estado: 'pendente_pagamento' },
        lugaresVivosCount: 1,
        lugaresVivosLoading: false,
      }),
    ).toMatch(/pagamento pendente será cancelado/);
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'reservado',
        pagamento: { estado: 'pendente_pagamento' },
        lugaresVivosCount: 1,
        lugaresVivosLoading: false,
      }),
    ).toMatch(/És o último passageiro/);
  });

  it('último passageiro com justa causa pendente: não promete «encerrado» (gate servidor)', () => {
    const msg = copyConfirmacaoSaidaPassageiro({
      lugarEstado: 'activo',
      pagamento: { estado: 'em_custodia' },
      lugaresVivosCount: 1,
      lugaresVivosLoading: false,
      rescisao_modo: 'justa_causa',
      rescisao_confirmada_em: null,
    });
    expect(msg).toMatch(/Saída individual/);
    expect(msg).toMatch(/quota deste mês não é reembolsada/);
    expect(msg).not.toMatch(/És o último passageiro/);
  });

  it('confirmação com contagem > 1 mantém copy de saída individual', () => {
    expect(
      copyConfirmacaoSaidaPassageiro({
        lugarEstado: 'activo',
        pagamento: { estado: 'em_custodia' },
        lugaresVivosCount: 2,
        lugaresVivosLoading: false,
      }),
    ).toMatch(/A tua quota deste mês não é reembolsada/);
  });

  it('confirmação enquanto contagem carrega ou falhou — não mostra último passageiro', () => {
    const base = {
      lugarEstado: 'activo',
      pagamento: { estado: 'em_custodia' },
    };
    expect(
      copyConfirmacaoSaidaPassageiro({ ...base, lugaresVivosLoading: true }),
    ).toMatch(/A tua quota deste mês não é reembolsada/);
    expect(
      copyConfirmacaoSaidaPassageiro({
        ...base,
        lugaresVivosLoading: false,
        lugaresVivosCount: null,
      }),
    ).toMatch(/A tua quota deste mês não é reembolsada/);
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
