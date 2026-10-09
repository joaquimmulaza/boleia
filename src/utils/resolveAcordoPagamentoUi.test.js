import { describe, it, expect } from 'vitest';
import {
  resolveAcordoPagamentoUiPassageiro,
  copyCartaoEstadoPagamentoPassageiro,
  linhaSecundariaCartaoS2,
  linhaMotoristaComprovativoValidacao,
  linhaJaConfirmadoRescisaoConsensual,
} from './resolveAcordoPagamentoUi.js';

describe('resolveAcordoPagamentoUi — P0 Figma', () => {
  it('S1 reserva expirada por falta de pagamento (TTL)', () => {
    const ui = resolveAcordoPagamentoUiPassageiro({
      minhaLinha: { estado: 'expirado' },
      pagamento: {
        estado: 'anulado',
        anulacao_motivo: 'Reserva terminada sem activação',
      },
      obrigacao: { valor_em_divida: 0, quota: 43000 },
    });
    expect(ui.variant).toBe('S1');
    expect(ui.sheetTitle).toBe('A tua reserva expirou');
    expect(ui.ocultarPainelPagamento).toBe(true);
    const copy = copyCartaoEstadoPagamentoPassageiro('S1', {});
    expect(copy.corpo).toMatch(/não tens nada a pagar/);
  });

  it('S3 saída antes da activação com lugar expirado e pagamento anulado (não S1)', () => {
    const ui = resolveAcordoPagamentoUiPassageiro({
      minhaLinha: { estado: 'expirado' },
      pagamento: {
        estado: 'anulado',
        anulacao_motivo: 'Saíste antes da activação do lugar',
        valor_quota_original_kz: 16000,
      },
      obrigacao: { valor_em_divida: 0 },
    });
    expect(ui.variant).toBe('S3');
    expect(ui.sheetTitle).toBe('Não tens nada a pagar');
    const copy = copyCartaoEstadoPagamentoPassageiro('S3', {
      pagamento: {
        estado: 'anulado',
        anulacao_motivo: 'Saíste antes da activação do lugar',
        valor_quota_original_kz: 16000,
      },
      obrigacao: { valor_em_divida: 0 },
    });
    expect(copy.corpo).toMatch(/foi cancelado/);
    expect(copy.secundaria).toMatch(/Saíste antes da activação/);
  });

  it('S2 saída com dívida', () => {
    const ui = resolveAcordoPagamentoUiPassageiro({
      minhaLinha: { estado: 'saiu' },
      pagamento: { estado: 'pendente_pagamento' },
      obrigacao: { valor_em_divida: 8000, proporcional: 12000, pago: 4000, dias: 4, dias_mes: 22, mes: '2026-10-01' },
    });
    expect(ui.variant).toBe('S2');
    expect(ui.sheetTitle).toBe('Saíste do acordo');
    const copy = copyCartaoEstadoPagamentoPassageiro('S2', {
      pagamento: { estado: 'pendente_pagamento' },
      obrigacao: { valor_em_divida: 8000, proporcional: 12000, pago: 4000, dias: 4, dias_mes: 22, mes: '2026-10-01' },
    });
    expect(copy.corpo).toMatch(/8[\s\u00a0]?000/);
    expect(copy.mostrarUploadNoCartao).toBe(true);
    expect(linhaSecundariaCartaoS2({
      proporcional: 12000,
      pago: 4000,
      dias: 4,
      dias_mes: 22,
      mes: '2026-10-01',
    })).toMatch(/Já pagaste 4[\s\u00a0]?000/);
  });

  it('S3 dívida cancelada', () => {
    const ui = resolveAcordoPagamentoUiPassageiro({
      minhaLinha: { estado: 'saiu' },
      pagamento: { estado: 'anulado', valor_quota_original_kz: 15000 },
      obrigacao: { valor_em_divida: 0 },
    });
    expect(ui.variant).toBe('S3');
    expect(ui.sheetTitle).toBe('Não tens nada a pagar');
  });

  it('S6a diferença em análise', () => {
    const ui = resolveAcordoPagamentoUiPassageiro({
      minhaLinha: { estado: 'saiu' },
      pagamento: { estado: 'em_custodia', requer_resolucao_admin: true },
      obrigacao: { pago: 12000, proporcional: 9773, valor_em_divida: 0 },
    });
    expect(ui.variant).toBe('S6a');
    expect(ui.sheetTitle).toBe('Diferença em análise');
  });

  it('linha motorista comprovativo em validação', () => {
    expect(linhaMotoristaComprovativoValidacao('Maria', 50000)).toBe(
      'Maria · comprovativo de 50\u00a0000 Kz em validação',
    );
  });

  it('S5 copy já confirmado', () => {
    const linha = linhaJaConfirmadoRescisaoConsensual('2026-10-01T12:00:00.000Z');
    expect(linha).toMatch(/^Já tinhas confirmado a /);
  });
});
