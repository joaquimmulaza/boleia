import { describe, it, expect } from 'vitest';
import {
  resolveNegociacaoPrecoAtiva,
  isAdendaAguardandoResposta,
  isAdendaRecusadaValida,
  isContraparteAdenda,
  podeNovaPropostaAposRecusa,
  podeProporNovaPreco,
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

  it('podeRetirarProposta — só iniciador em pendente ou rejeitada', () => {
    expect(
      podeRetirarProposta({ ...baseAdenda, estado: 'pendente_passageiro' }, 'mot-1'),
    ).toBe(true);
    expect(
      podeRetirarProposta({ ...baseAdenda, estado: 'rejeitada' }, 'mot-1'),
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

  it('podeVoltarAAceitar — motorista propôs, passageiro pode voltar a aceitar', () => {
    const adenda = { ...baseAdenda, estado: 'rejeitada', created_by: 'mot-1' };
    expect(
      podeVoltarAAceitar(adenda, {
        userId: 'pax-1',
        isPassageiro: true,
        janelaAberta: true,
        driverId: 'mot-1',
      }),
    ).toBe(true);
    expect(
      podeVoltarAAceitar(adenda, {
        userId: 'mot-1',
        isMotorista: true,
        janelaAberta: true,
        driverId: 'mot-1',
      }),
    ).toBe(false);
  });

  it('podeVoltarAAceitar — passageiro propôs, motorista pode voltar a aceitar', () => {
    const adenda = { ...baseAdenda, estado: 'rejeitada', created_by: 'pax-1' };
    expect(
      podeVoltarAAceitar(adenda, {
        userId: 'mot-1',
        isMotorista: true,
        janelaAberta: true,
        driverId: 'mot-1',
      }),
    ).toBe(true);
    expect(
      podeVoltarAAceitar(adenda, {
        userId: 'pax-1',
        isPassageiro: true,
        janelaAberta: true,
        driverId: 'mot-1',
      }),
    ).toBe(false);
  });

  it('isContraparteAdenda rejeitada — autoriza pela contraparte de created_by', () => {
    const rejeitadaMot = { ...baseAdenda, estado: 'rejeitada', created_by: 'mot-1' };
    expect(
      isContraparteAdenda(rejeitadaMot, { isPassageiro: true, driverId: 'mot-1' }),
    ).toBe(true);
    expect(
      isContraparteAdenda(rejeitadaMot, { isMotorista: true, driverId: 'mot-1' }),
    ).toBe(false);

    const rejeitadaPax = { ...baseAdenda, estado: 'rejeitada', created_by: 'pax-1' };
    expect(
      isContraparteAdenda(rejeitadaPax, { isMotorista: true, driverId: 'mot-1' }),
    ).toBe(true);
    expect(
      isContraparteAdenda(rejeitadaPax, { isPassageiro: true, driverId: 'mot-1' }),
    ).toBe(false);
  });

  it('podeProporNovaPreco — proponente pode propor de novo após recusa', () => {
    const rejeitada = { ...baseAdenda, estado: 'rejeitada', created_by: 'mot-1' };
    expect(
      podeProporNovaPreco(rejeitada, { userId: 'mot-1', janelaAberta: true }),
    ).toBe(true);
    expect(
      podeProporNovaPreco(rejeitada, { userId: 'pax-1', janelaAberta: true }),
    ).toBe(false);
    expect(
      podeProporNovaPreco(null, { userId: 'mot-1', janelaAberta: true }),
    ).toBe(true);
    expect(
      podeProporNovaPreco(
        { ...baseAdenda, estado: 'pendente_passageiro' },
        { userId: 'mot-1', janelaAberta: true },
      ),
    ).toBe(false);
  });

  it('podeNovaPropostaAposRecusa — alias proponente + rejeitada', () => {
    const adenda = { ...baseAdenda, estado: 'rejeitada', created_by: 'pax-1' };
    expect(
      podeNovaPropostaAposRecusa(adenda, { userId: 'pax-1', janelaAberta: true }),
    ).toBe(true);
  });

  it('labelChipHistoricoAdenda — copy humana', () => {
    expect(labelChipHistoricoAdenda({ estado: 'em_vigor', effective_from: '2026-11-01' }))
      .toMatch(/Em vigor/i);
    expect(labelChipHistoricoAdenda({ estado: 'cancelada_substituta' })).toBe('Substituída');
    expect(labelChipHistoricoAdenda({ estado: 'cancelada_iniciador' })).toBe('Retirada');
  });
});
