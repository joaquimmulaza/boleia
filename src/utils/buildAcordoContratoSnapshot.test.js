import { describe, it, expect } from 'vitest';
import {
  buildAcordoContratoSnapshot,
  buildContratoSnapshotFromProposta,
} from './buildAcordoContratoSnapshot';

describe('buildAcordoContratoSnapshot', () => {
  it('POR_PASSAGEIRO — devolve modalidade, N_contrato, total e por pessoa', () => {
    const snap = buildAcordoContratoSnapshot({
      modo_preco: 'POR_PASSAGEIRO',
      n_passageiros_contrato: 3,
      valor_mensal_por_passageiro_kz: 40000,
      valor_mensal_total_kz: 120000,
    });

    expect(snap.complete).toBe(true);
    expect(snap.modalidade).toBe('Por passageiro');
    expect(snap.nContrato).toBe(3);
    expect(snap.nLabel).toBe('Grupo · 3 pessoas');
    expect(snap.totalMensalKz).toBe(120000);
    expect(snap.porPassageiroKz).toBe(40000);
    expect(snap.valorReferenciaLabel).toBe('Valor por passageiro');
    expect(snap.valorReferenciaKz).toBe(40000);
    expect(snap.temResto).toBe(false);
  });

  it('TOTAL_ACORDO — usa total como referência e detecta resto', () => {
    const snap = buildAcordoContratoSnapshot({
      modo_preco: 'TOTAL_ACORDO',
      n_passageiros_contrato: 3,
      valor_mensal_por_passageiro_kz: 40000,
      valor_mensal_total_kz: 100000,
    });

    expect(snap.complete).toBe(true);
    expect(snap.modalidade).toBe('Total do acordo');
    expect(snap.valorReferenciaLabel).toBe('Total do acordo');
    expect(snap.valorReferenciaKz).toBe(100000);
    expect(snap.temResto).toBe(true);
  });

  it('N=1 usa label Individual', () => {
    const snap = buildAcordoContratoSnapshot({
      modo_preco: 'POR_PASSAGEIRO',
      n_passageiros_contrato: 1,
      valor_mensal_por_passageiro_kz: 35000,
      valor_mensal_total_kz: 35000,
    });

    expect(snap.nLabel).toBe('Individual');
  });

  it('N=1 com primeiro nome do passageiro substitui Individual', () => {
    const snap = buildAcordoContratoSnapshot(
      {
        modo_preco: 'POR_PASSAGEIRO',
        n_passageiros_contrato: 1,
        valor_mensal_por_passageiro_kz: 35000,
        valor_mensal_total_kz: 35000,
      },
      { primeiroNomePassageiro: 'Ana Costa' },
    );

    expect(snap.nLabel).toBe('Ana');
  });

  it('campos em falta — incomplete sem inventar defaults', () => {
    const snap = buildAcordoContratoSnapshot({
      modo_preco: 'POR_PASSAGEIRO',
      n_passageiros_contrato: null,
      valor_mensal_por_passageiro_kz: 40000,
      valor_mensal_total_kz: 120000,
    });

    expect(snap.complete).toBe(false);
    expect(snap.missingFields).toContain('n_passageiros_contrato');
    expect(snap.totalMensalKz).toBeUndefined();
    expect(snap.porPassageiroKz).toBeUndefined();
  });

  it('modo desconhecido — incomplete', () => {
    const snap = buildAcordoContratoSnapshot({
      modo_preco: 'INVALIDO',
      n_passageiros_contrato: 2,
      valor_mensal_por_passageiro_kz: 40000,
      valor_mensal_total_kz: 80000,
    });

    expect(snap.complete).toBe(false);
    expect(snap.missingFields).toContain('modo_preco');
  });

  it('nunca expõe enums na modalidade', () => {
    const snap = buildAcordoContratoSnapshot({
      modo_preco: 'TOTAL_ACORDO',
      n_passageiros_contrato: 2,
      valor_mensal_por_passageiro_kz: 50000,
      valor_mensal_total_kz: 100000,
    });

    expect(snap.modalidade).not.toMatch(/TOTAL_ACORDO|POR_PASSAGEIRO/);
  });
});

describe('buildContratoSnapshotFromProposta', () => {
  it('resolve snapshot a partir de proposta + pricing antes do aceite', () => {
    const snap = buildContratoSnapshotFromProposta({
      modo_preco: 'POR_PASSAGEIRO',
      n_passageiros_propostos: 2,
      pricing: {
        valor_mensal_total_kz: 80000,
        valor_mensal_por_passageiro_kz: 40000,
        temResto: false,
      },
    });

    expect(snap.complete).toBe(true);
    expect(snap.modalidade).toBe('Por passageiro');
    expect(snap.nContrato).toBe(2);
    expect(snap.totalMensalKz).toBe(80000);
    expect(snap.porPassageiroKz).toBe(40000);
  });

  it('pricing em falta — incomplete', () => {
    const snap = buildContratoSnapshotFromProposta({
      modo_preco: 'TOTAL_ACORDO',
      n_passageiros_propostos: 3,
      pricing: null,
    });

    expect(snap.complete).toBe(false);
  });
});
