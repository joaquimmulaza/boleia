import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildPropostaReview,
  buildPreferentialMapPoints,
  loadPropostaReview,
} from './propostaReview.js';
import { listMembrosGrupo } from '../services/GrupoService.js';

vi.mock('../services/GrupoService.js', () => ({
  listMembrosGrupo: vi.fn(),
}));

const propostaGrupo = {
  id: 'prop-1',
  grupo_id: 'g-1',
  modo_preco: 'TOTAL_ACORDO',
  valor_mensal_ask_kz: 100000,
  n_passageiros_propostos: 3,
};

const membrosTres = [
  {
    passenger_id: 'pax-1',
    ordem_insercao: 0,
    pickup_name: 'Talatona',
    pickup_lat: -8.92,
    pickup_lng: 13.18,
    dropoff_name: 'Mutamba',
    dropoff_lat: -8.81,
    dropoff_lng: 13.23,
    telefone: '+244923000001',
    perfis: { nome_completo: 'Ana Silva', telefone: '+244923000001' },
  },
  {
    passenger_id: 'pax-2',
    ordem_insercao: 1,
    pickup_name: 'Benfica',
    pickup_lat: -8.85,
    pickup_lng: 13.2,
    dropoff_name: null,
    dropoff_lat: null,
    dropoff_lng: null,
    telefone: '+244923000002',
    perfis: { nome_completo: 'Bruno Costa', telefone: '+244923000002' },
  },
  {
    passenger_id: 'pax-3',
    ordem_insercao: 2,
    pickup_name: null,
    pickup_lat: null,
    pickup_lng: null,
    dropoff_name: null,
    dropoff_lat: null,
    dropoff_lng: null,
    telefone: '+244923000003',
    perfis: { nome_completo: 'Carla Dias', telefone: '+244923000003' },
  },
];

describe('buildPropostaReview', () => {
  it('com grupo: título «Grupo · N pessoas» e membros com quotas do resto', () => {
    const review = buildPropostaReview(propostaGrupo, membrosTres);

    expect(review.titulo).toBe('Grupo · 3 pessoas');
    expect(review.membros).toHaveLength(3);
    expect(review.membros[0]).toEqual({
      passenger_id: 'pax-1',
      nome: 'Ana Silva',
      telefone: '+244923000001',
      pickup_name: 'Talatona',
      pickup_lat: -8.92,
      pickup_lng: 13.18,
      dropoff_name: 'Mutamba',
      dropoff_lat: -8.81,
      dropoff_lng: 13.23,
      quota_mensal_kz: 33334,
    });
    expect(review.membros[1]).toMatchObject({
      pickup_lat: -8.85,
      pickup_lng: 13.2,
      dropoff_name: null,
      dropoff_lat: null,
      dropoff_lng: null,
      quota_mensal_kz: 33333,
    });
    expect(review.membros[2]).toMatchObject({
      pickup_lat: null,
      pickup_lng: null,
      dropoff_name: null,
      dropoff_lat: null,
      dropoff_lng: null,
      quota_mensal_kz: 33333,
    });
    expect(review.pricing.valor_mensal_total_kz).toBe(100000);
    expect(review.pricing.valor_mensal_por_passageiro_kz).toBe(33333);
    expect(review.pricing.temResto).toBe(true);
    expect(review.avisoComposicao).toBeNull();
  });

  it('usa singular «pessoa» / «passageiro» quando N=1', () => {
    const comGrupo = buildPropostaReview(
      {
        ...propostaGrupo,
        n_passageiros_propostos: 1,
        valor_mensal_ask_kz: 40000,
        modo_preco: 'POR_PASSAGEIRO',
      },
      [membrosTres[0]],
    );
    expect(comGrupo.titulo).toBe('Grupo · 1 pessoa');

    const solo = buildPropostaReview(
      {
        id: 'prop-solo',
        grupo_id: null,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        n_passageiros_propostos: 1,
      },
      [],
    );
    expect(solo.titulo).toBe('1 passageiro');
  });

  it('sem grupo: título «N passageiros» e lista vazia não lança', () => {
    const review = buildPropostaReview(
      {
        id: 'prop-2',
        grupo_id: null,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        n_passageiros_propostos: 1,
      },
      [],
    );

    expect(review.titulo).toBe('1 passageiro');
    expect(review.membros).toEqual([]);
    expect(review.pricing.valor_mensal_total_kz).toBe(40000);
    expect(review.pricing.temResto).toBe(false);
    expect(review.avisoComposicao).toBeNull();
  });

  it('corta aos primeiros n_passageiros_propostos membros e avisa se o grupo cresceu', () => {
    const review = buildPropostaReview(
      { ...propostaGrupo, n_passageiros_propostos: 2, valor_mensal_ask_kz: 80000 },
      membrosTres,
    );

    expect(review.membros).toHaveLength(2);
    expect(review.membros.map((m) => m.nome)).toEqual(['Ana Silva', 'Bruno Costa']);
    expect(review.titulo).toBe('Grupo · 2 pessoas');
    expect(review.avisoComposicao).toMatch(/mais pessoas|nova proposta/i);
    expect(review.avisoComposicao).not.toMatch(/N_/);
    expect(review.avisoComposicao).not.toMatch(/incompleto/i);
  });

  it('avisoComposicao quando N_actual > N_proposto sem mutar o tamanho da proposta', () => {
    const review = buildPropostaReview(propostaGrupo, [
      ...membrosTres,
      {
        passenger_id: 'pax-4',
        ordem_insercao: 3,
        pickup_name: null,
        perfis: { nome_completo: 'Diana' },
      },
    ]);

    expect(review.membros).toHaveLength(3);
    expect(review.titulo).toBe('Grupo · 3 pessoas');
    expect(review.avisoComposicao).toMatch(/3 de 4|nova proposta/i);
    expect(review.avisoComposicao).not.toMatch(/N_proposto|N_actual/);
  });

  it('fallback de nome «Passageiro» quando perfil sem nome_completo', () => {
    const review = buildPropostaReview(propostaGrupo, [
      {
        passenger_id: 'pax-x',
        ordem_insercao: 0,
        pickup_name: 'Kilamba',
        telefone: '+244900000000',
        perfis: null,
      },
      membrosTres[1],
      membrosTres[2],
    ]);

    expect(review.membros[0].nome).toBe('Passageiro');
    expect(review.membros[0].telefone).toBe('+244900000000');
  });

  it('avisoComposicao suave quando há menos membros activos que o proposto', () => {
    const review = buildPropostaReview(propostaGrupo, [membrosTres[0], membrosTres[1]]);

    expect(review.avisoComposicao).toMatch(/aceit/i);
    expect(review.avisoComposicao).not.toMatch(/N_/);
    expect(review.membros).toHaveLength(2);
  });

  it('POR_PASSAGEIRO: temResto falso e quotas iguais', () => {
    const review = buildPropostaReview(
      {
        ...propostaGrupo,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
      },
      membrosTres,
    );

    expect(review.pricing.temResto).toBe(false);
    expect(review.pricing.quotas).toEqual([40000, 40000, 40000]);
    expect(review.membros[0].quota_mensal_kz).toBe(40000);
  });

  it('TOTAL_ACORDO sem resto: temResto falso', () => {
    const review = buildPropostaReview(
      {
        ...propostaGrupo,
        n_passageiros_propostos: 4,
        valor_mensal_ask_kz: 120000,
      },
      [...membrosTres, { ...membrosTres[0], passenger_id: 'pax-4', ordem_insercao: 3 }],
    );

    expect(review.pricing.temResto).toBe(false);
  });

  it('mapeia coords null-safe quando campos em falta na linha', () => {
    const review = buildPropostaReview(
      {
        ...propostaGrupo,
        n_passageiros_propostos: 1,
        valor_mensal_ask_kz: 40000,
        modo_preco: 'POR_PASSAGEIRO',
      },
      [{ passenger_id: 'pax-z', ordem_insercao: 0, perfis: { nome_completo: 'Zé' } }],
    );

    expect(review.membros[0]).toMatchObject({
      pickup_name: null,
      pickup_lat: null,
      pickup_lng: null,
      dropoff_name: null,
      dropoff_lat: null,
      dropoff_lng: null,
    });
  });
});

describe('buildPreferentialMapPoints', () => {
  it('inclui recolha e desembarque com coords válidas e ids estáveis', () => {
    const review = buildPropostaReview(propostaGrupo, membrosTres);
    const points = buildPreferentialMapPoints(review.membros);

    expect(points).toEqual([
      {
        id: 'pax-1-recolha',
        label: 'Talatona',
        kind: 'recolha',
        lat: -8.92,
        lng: 13.18,
        memberIndex: 1,
      },
      {
        id: 'pax-1-desembarque',
        label: 'Mutamba',
        kind: 'desembarque',
        lat: -8.81,
        lng: 13.23,
        memberIndex: 1,
      },
      {
        id: 'pax-2-recolha',
        label: 'Benfica',
        kind: 'recolha',
        lat: -8.85,
        lng: 13.2,
        memberIndex: 2,
      },
    ]);
  });

  it('filtra coords inválidas e usa fallbacks de label', () => {
    const points = buildPreferentialMapPoints([
      {
        passenger_id: 'pax-a',
        pickup_name: null,
        pickup_lat: -8.9,
        pickup_lng: 13.1,
        dropoff_name: null,
        dropoff_lat: Number.NaN,
        dropoff_lng: 13.2,
      },
      {
        passenger_id: null,
        pickup_name: 'X',
        pickup_lat: Infinity,
        pickup_lng: 13.1,
        dropoff_name: null,
        dropoff_lat: -8.8,
        dropoff_lng: 13.25,
      },
      {
        passenger_id: 'pax-c',
        pickup_name: 'Y',
        pickup_lat: null,
        pickup_lng: 13.1,
        dropoff_name: 'Z',
        dropoff_lat: -8.7,
        dropoff_lng: undefined,
      },
    ]);

    expect(points).toEqual([
      {
        id: 'pax-a-recolha',
        label: 'Recolha',
        kind: 'recolha',
        lat: -8.9,
        lng: 13.1,
        memberIndex: 1,
      },
      {
        id: '1-desembarque',
        label: 'Desembarque',
        kind: 'desembarque',
        lat: -8.8,
        lng: 13.25,
        memberIndex: 2,
      },
    ]);
  });

  it('devolve array vazio quando membros sem coords ou lista vazia', () => {
    expect(buildPreferentialMapPoints([])).toEqual([]);
    expect(
      buildPreferentialMapPoints([
        {
          passenger_id: 'pax-x',
          pickup_name: 'Só nome',
          pickup_lat: null,
          pickup_lng: null,
          dropoff_name: null,
          dropoff_lat: null,
          dropoff_lng: null,
        },
      ]),
    ).toEqual([]);
  });
});

describe('loadPropostaReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('com grupo_id carrega membros via listMembrosGrupo', async () => {
    listMembrosGrupo.mockResolvedValue(membrosTres);

    const review = await loadPropostaReview(propostaGrupo);

    expect(listMembrosGrupo).toHaveBeenCalledWith('g-1');
    expect(review.titulo).toBe('Grupo · 3 pessoas');
    expect(review.membros).toHaveLength(3);
  });

  it('sem grupo_id não chama listMembrosGrupo e devolve revisão vazia', async () => {
    const review = await loadPropostaReview({
      id: 'prop-solo',
      grupo_id: null,
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 40000,
      n_passageiros_propostos: 1,
    });

    expect(listMembrosGrupo).not.toHaveBeenCalled();
    expect(review.membros).toEqual([]);
    expect(review.titulo).toBe('1 passageiro');
  });
});
