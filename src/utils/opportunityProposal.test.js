import { describe, it, expect } from 'vitest';
import { formatKwanza } from './formatKwanza';
import {
  COPY_N_FIXO,
  resolveOpportunityProposal,
} from './opportunityProposal';

const procura = {
  origin_name: 'Viana',
  destination_name: 'Talatona',
  preferred_time: '07:15',
  dias_semana: [1, 2, 3, 4, 5],
  n_candidato: 8,
  n_actual: 8,
};

describe('opportunityProposal — snapshot e preço', () => {
  it('motorista para grupo usa N_proposto e não multiplica o total do acordo', () => {
    const sheet = resolveOpportunityProposal({
      papel: 'motorista',
      alvo: 'grupo',
      item: {
        ...procura,
        nome: 'Grupo da paróquia',
        flexibilidade_rota: true,
        origin_name: null,
        destination_name: null,
        modo_preco: 'TOTAL_ACORDO',
      },
      nProposto: 3,
      valorKz: 30000,
      modoPreco: 'TOTAL_ACORDO',
    });

    expect(sheet.snapshotNote).toBe(COPY_N_FIXO);
    expect(sheet.stepper).toBe(false);
    expect(sheet.contagem).toBe('3 passageiros');
    expect(sheet.rota).toBeNull();
    expect(sheet.headline).toBe('Disponível para acordos');
    expect(sheet.precoUnico).toEqual({
      valor: `${formatKwanza(30000)} Kz`,
      modo: 'Total do acordo',
    });
    expect(sheet.total).toBeNull();
    expect(JSON.stringify(sheet)).not.toContain(formatKwanza(90000));
    expect(JSON.stringify(sheet)).not.toContain(formatKwanza(240000));
  });

  it('motorista para um passageiro congela N e o total por passageiro é o snapshot', () => {
    const sheet = resolveOpportunityProposal({
      papel: 'motorista',
      alvo: 'passageiro',
      item: procura,
      nProposto: 1,
      valorKz: 10000,
      modoPreco: 'POR_PASSAGEIRO',
    });

    expect(sheet.snapshotNote).toBe(COPY_N_FIXO);
    expect(sheet.stepper).toBe(false);
    expect(sheet.contagem).toBe('1 passageiro');
    expect(sheet.rota).toEqual({ origem: 'Viana', destino: 'Talatona' });
    expect(sheet.precoPorPassageiro).toBe(`${formatKwanza(10000)} Kz por passageiro`);
    expect(sheet.total).toEqual({ label: 'Total', valor: `${formatKwanza(10000)} Kz` });
    expect(JSON.stringify(sheet)).not.toContain(formatKwanza(80000));
  });

  it('grupo por passageiro multiplica só o snapshot, não o N vivo', () => {
    const sheet = resolveOpportunityProposal({
      papel: 'motorista',
      alvo: 'grupo',
      item: { ...procura, nome: 'Grupo da paróquia' },
      nProposto: 3,
      valorKz: 10000,
      modoPreco: 'POR_PASSAGEIRO',
    });

    expect(sheet.snapshotNote).toBe(COPY_N_FIXO);
    expect(sheet.contagem).toBe('3 passageiros');
    expect(sheet.nome).toBe('Grupo da paróquia');
    expect(sheet.total).toEqual({ label: 'Total', valor: `${formatKwanza(30000)} Kz` });
    expect(JSON.stringify(sheet)).not.toContain(formatKwanza(80000));
  });

  it('o stepper do passageiro não leva a frase do número fixo', () => {
    const sheet = resolveOpportunityProposal({
      papel: 'passageiro',
      alvo: 'passageiro',
      item: procura,
      nProposto: 1,
      valorKz: 10000,
      modoPreco: 'POR_PASSAGEIRO',
    });

    expect(sheet.snapshotNote).toBeNull();
    expect(sheet.stepper).toBe(true);
    expect(sheet.total.label).toBe('Total estimado');
    expect(JSON.stringify(sheet)).not.toContain(COPY_N_FIXO);
  });

  it('oferta fixa sem destino não inventa rota', () => {
    const sheet = resolveOpportunityProposal({
      papel: 'motorista',
      alvo: 'passageiro',
      item: { ...procura, destination_name: null },
      nProposto: 1,
      valorKz: 10000,
      modoPreco: 'POR_PASSAGEIRO',
    });

    expect(sheet.rota).toBeNull();
    expect(JSON.stringify(sheet)).not.toMatch(/Destino|Origem/);
  });
});
