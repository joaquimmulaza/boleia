import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildPropostaReview, loadPropostaReview } from './propostaReview.js';
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
    telefone: '+244923000001',
    perfis: { nome_completo: 'Ana Silva', telefone: '+244923000001' },
  },
  {
    passenger_id: 'pax-2',
    ordem_insercao: 1,
    pickup_name: 'Benfica',
    telefone: '+244923000002',
    perfis: { nome_completo: 'Bruno Costa', telefone: '+244923000002' },
  },
  {
    passenger_id: 'pax-3',
    ordem_insercao: 2,
    pickup_name: null,
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
      quota_mensal_kz: 33334,
    });
    expect(review.membros[1].quota_mensal_kz).toBe(33333);
    expect(review.membros[2].quota_mensal_kz).toBe(33333);
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

  it('corta aos primeiros n_passageiros_propostos membros', () => {
    const review = buildPropostaReview(
      { ...propostaGrupo, n_passageiros_propostos: 2, valor_mensal_ask_kz: 80000 },
      membrosTres,
    );

    expect(review.membros).toHaveLength(2);
    expect(review.membros.map((m) => m.nome)).toEqual(['Ana Silva', 'Bruno Costa']);
    expect(review.titulo).toBe('Grupo · 2 pessoas');
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
