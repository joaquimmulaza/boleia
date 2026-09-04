import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProposta,
  listPropostasByProcura,
  listPropostasByOferta,
  rejectProposta,
  enrichPropostasForReview,
} from './PropostaService.js';
import { supabase } from '../lib/supabase';
import { listMembrosGrupo } from './GrupoService.js';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

vi.mock('./GrupoService.js', () => ({
  listMembrosGrupo: vi.fn(),
}));

describe('PropostaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createProposta cria proposta aberta 1:M com snapshot N', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'driver-1' } },
    });
    const mockSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'prop-1',
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        n_passageiros_propostos: 3,
        estado: 'aberta',
        modo_preco: 'TOTAL_ACORDO',
      },
      error: null,
    });
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });

    const result = await createProposta({
      oferta_id: 'of-1',
      procura_id: 'pr-1',
      grupo_id: 'g-1',
      modo_preco: 'TOTAL_ACORDO',
      valor_mensal_ask_kz: 120000,
      n_passageiros_propostos: 3,
    });

    expect(result.estado).toBe('aberta');
    expect(result.n_passageiros_propostos).toBe(3);
  });

  it('createProposta exige grupo_id quando N > 1', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-1' } },
    });
    await expect(
      createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 3,
      }),
    ).rejects.toThrow(/grupo/i);
  });

  it('createProposta rejeita N < 1', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'driver-1' } },
    });
    await expect(
      createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        n_passageiros_propostos: 0,
      }),
    ).rejects.toThrow('passageiros');
  });

  it('listPropostasByProcura devolve M propostas', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'p1' }, { id: 'p2' }],
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });
    const result = await listPropostasByProcura('pr-1');
    expect(result).toHaveLength(2);
  });

  it('listPropostasByOferta filtra por oferta', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'p1' }], error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });
    const result = await listPropostasByOferta('of-1');
    expect(result).toHaveLength(1);
  });

  it('rejectProposta marca rejeitada', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'prop-1', estado: 'rejeitada' },
      error: null,
    });
    supabase.from.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ single: mockSingle }),
        }),
      }),
    });
    const result = await rejectProposta('prop-1');
    expect(result.estado).toBe('rejeitada');
  });

  it('enrichPropostasForReview anexa review a cada proposta em paralelo', async () => {
    listMembrosGrupo.mockResolvedValue([
      {
        passenger_id: 'pax-1',
        ordem_insercao: 0,
        pickup_name: 'Talatona',
        perfis: { nome_completo: 'Ana', telefone: '+244923000001' },
      },
      {
        passenger_id: 'pax-2',
        ordem_insercao: 1,
        pickup_name: 'Benfica',
        perfis: { nome_completo: 'Bruno', telefone: '+244923000002' },
      },
    ]);

    const propostas = [
      {
        id: 'prop-g',
        grupo_id: 'g-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 80000,
        n_passageiros_propostos: 2,
        estado: 'aberta',
      },
      {
        id: 'prop-solo',
        grupo_id: null,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 40000,
        n_passageiros_propostos: 1,
        estado: 'aberta',
      },
    ];

    const enriched = await enrichPropostasForReview(propostas);

    expect(enriched).toHaveLength(2);
    expect(enriched[0].proposta.id).toBe('prop-g');
    expect(enriched[0].titulo).toBe('Grupo · 2 pessoas');
    expect(enriched[0].membros).toHaveLength(2);
    expect(enriched[0].membros[0].passenger_id).toBe('pax-1');
    expect(enriched[0].pricing.valor_mensal_total_kz).toBe(80000);
    expect(listMembrosGrupo).toHaveBeenCalledWith('g-1');

    expect(enriched[1].proposta.id).toBe('prop-solo');
    expect(enriched[1].titulo).toBe('1 passageiro');
    expect(enriched[1].membros).toEqual([]);
    expect(listMembrosGrupo).toHaveBeenCalledTimes(1);
  });

  it('enrichPropostasForReview devolve [] para lista vazia', async () => {
    const enriched = await enrichPropostasForReview([]);
    expect(enriched).toEqual([]);
    expect(listMembrosGrupo).not.toHaveBeenCalled();
  });
});
