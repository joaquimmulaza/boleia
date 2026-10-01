import { describe, it, expect } from 'vitest';
import {
  resolveNegociacaoPrecoAtiva,
  isAdendaAguardandoResposta,
  isAdendaRecusadaValida,
  podeRetirarProposta,
  podeContraPropor,
  podeVoltarAAceitar,
  labelChipHistoricoAdenda,
} from './adendaNegociacao.js';

const baseAdenda = {
  id: 'a1',
  created_by: 'mot-1',
  applied_at: null,
  superseded_at: null,
  effective_from: '2026-11-01',
  valor_mensal_por_passageiro_kz: 28000,
  created_at: '2026-10-10T10:00:00.000Z',
};

describe('adendaNegociacao — uma negociação activa', () => {
  it('resolveNegociacaoPrecoAtiva inclui pendente e rejeitada', () => {
    const rows = [
      { ...baseAdenda, estado: 'cancelada_iniciador', superseded_at: '2026-10-09' },
      { ...baseAdenda, id: 'a2', estado: 'rejeitada' },
    ];
    expect(resolveNegociacaoPrecoAtiva(rows)?.id).toBe('a2');
  });

  it('isAdendaAguardandoResposta só para pendente_*', () => {
    expect(isAdendaAguardandoResposta('pendente_passageiro')).toBe(true);
    expect(isAdendaAguardandoResposta('rejeitada')).toBe(false);
  });

  it('isAdendaRecusadaValida exige rejeitada + janela aberta', () => {
    expect(isAdendaRecusadaValida({ estado: 'rejeitada' }, true)).toBe(true);
    expect(isAdendaRecusadaValida({ estado: 'rejeitada' }, false)).toBe(false);
  });

  it('podeRetirarProposta — só iniciador em pendente', () => {
    expect(
      podeRetirarProposta({ ...baseAdenda, estado: 'pendente_passageiro' }, 'mot-1'),
    ).toBe(true);
    expect(
      podeRetirarProposta({ ...baseAdenda, estado: 'pendente_passageiro' }, 'pax-1'),
    ).toBe(false);
  });

  it('podeContraPropor — contraparte com janela aberta', () => {
    const adenda = { ...baseAdenda, estado: 'pendente_passageiro' };
    expect(
      podeContraPropor(adenda, { userId: 'pax-1', isPassageiro: true, janelaAberta: true }),
    ).toBe(true);
    expect(
      podeContraPropor(adenda, { userId: 'pax-1', isPassageiro: true, janelaAberta: false }),
    ).toBe(false);
  });

  it('podeVoltarAAceitar — contraparte pode mudar de ideias após recusa', () => {
    const adenda = { ...baseAdenda, estado: 'rejeitada' };
    expect(
      podeVoltarAAceitar(adenda, {
        userId: 'pax-1',
        isPassageiro: true,
        janelaAberta: true,
      }),
    ).toBe(true);
    expect(
      podeVoltarAAceitar(adenda, {
        userId: 'mot-1',
        isMotorista: true,
        janelaAberta: true,
      }),
    ).toBe(false);
  });

  it('labelChipHistoricoAdenda — copy humana', () => {
    expect(labelChipHistoricoAdenda({ estado: 'em_vigor', effective_from: '2026-11-01' }))
      .toMatch(/Em vigor/i);
    expect(labelChipHistoricoAdenda({ estado: 'cancelada_substituta' })).toBe('Substituída');
    expect(labelChipHistoricoAdenda({ estado: 'cancelada_iniciador' })).toBe('Retirada');
  });
});
