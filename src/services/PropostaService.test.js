import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProposta,
  listPropostasByProcura,
  listPropostasByOferta,
  rejectProposta,
} from './PropostaService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
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
});
