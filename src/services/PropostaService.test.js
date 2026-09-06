import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProposta,
  listPropostasByProcura,
  listPropostasByOferta,
  rejectProposta,
  cancelProposta,
  acceptProposal,
  enrichPropostasForReview,
} from './PropostaService.js';
import { createAgreementFromProposal } from './AgreementService.js';
import { supabase } from '../lib/supabase';
import { listMembrosGrupo } from './GrupoService.js';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'jwt-test' } },
      }),
    },
  },
}));

vi.mock('./GrupoService.js', () => ({
  listMembrosGrupo: vi.fn(),
}));

vi.mock('./AgreementService.js', () => ({
  createAgreementFromProposal: vi.fn(),
}));

describe('PropostaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
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

  it('G6 — Sense B createProposta como motorista grava created_by do autenticado', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'motorista-42' } },
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'prop-b',
            created_by: 'motorista-42',
            estado: 'aberta',
            n_passageiros_propostos: 1,
          },
          error: null,
        }),
      }),
    });
    supabase.from.mockReturnValue({ insert: mockInsert });

    const result = await createProposta({
      oferta_id: 'of-1',
      procura_id: 'pr-1',
      modo_preco: 'POR_PASSAGEIRO',
      valor_mensal_ask_kz: 35000,
      n_passageiros_propostos: 1,
    });

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        created_by: 'motorista-42',
        estado: 'aberta',
        oferta_id: 'of-1',
        procura_id: 'pr-1',
      }),
    ]);
    expect(result.created_by).toBe('motorista-42');
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

  it('rejectProposta chama RPC reject_proposal e devolve proposta rejeitada', async () => {
    supabase.rpc.mockResolvedValue({
      data: { id: 'prop-1', estado: 'rejeitada', created_by: 'pax-1' },
      error: null,
    });

    const result = await rejectProposta('prop-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reject_proposal', {
      p_proposta_id: 'prop-1',
    });
    expect(result.estado).toBe('rejeitada');
  });

  it('rejectProposta propaga erro quando o criador tenta rejeitar a própria proposta', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Só a contraparte pode aceitar ou rejeitar esta proposta.',
      },
    });

    await expect(rejectProposta('prop-1')).rejects.toThrow(/só a contraparte/i);
  });

  it('rejectProposta exige ID da proposta', async () => {
    await expect(rejectProposta('')).rejects.toThrow(/proposta/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('cancelProposta chama RPC cancel_proposal e devolve proposta cancelada', async () => {
    supabase.rpc.mockResolvedValue({
      data: { id: 'prop-1', estado: 'cancelada', created_by: 'pax-1' },
      error: null,
    });

    const result = await cancelProposta('prop-1');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'cancel_proposal',
      expect.objectContaining({
        p_proposta_id: 'prop-1',
        p_idempotency_key: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    );
    expect(result.estado).toBe('cancelada');
  });

  it('cancelProposta propaga erro quando a contraparte tenta cancelar', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        message: 'Só o criador pode cancelar esta proposta.',
      },
    });

    await expect(cancelProposta('prop-1')).rejects.toThrow(/só o criador/i);
  });

  it('cancelProposta exige ID da proposta', async () => {
    await expect(cancelProposta('')).rejects.toThrow(/proposta/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('acceptProposal encaminha memberIds para createAgreementFromProposal', async () => {
    createAgreementFromProposal.mockResolvedValue({ id: 'acordo-9' });

    const result = await acceptProposal('prop-9', ['p1', 'p2']);

    expect(createAgreementFromProposal).toHaveBeenCalledWith('prop-9', {
      memberIds: ['p1', 'p2'],
    });
    expect(result.id).toBe('acordo-9');
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
