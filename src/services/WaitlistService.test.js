import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  enqueueWaitlist,
  listWaitlistByOferta,
  listWaitlistByProcura,
  promoteWaitlist,
} from './WaitlistService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

describe('WaitlistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueueWaitlist insere entrada activa', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'w-1', oferta_id: 'of-1', procura_id: 'pr-1', estado: 'activa' },
      error: null,
    });
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });

    const result = await enqueueWaitlist({
      oferta_id: 'of-1',
      procura_id: 'pr-1',
    });
    expect(result.estado).toBe('activa');
  });

  it('enqueueWaitlist traduz conflito único', async () => {
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { code: '23505', message: 'duplicate' },
          }),
        }),
      }),
    });
    await expect(
      enqueueWaitlist({ oferta_id: 'of-1', procura_id: 'pr-1' }),
    ).rejects.toThrow('já está na lista de espera');
  });

  it('listWaitlistByOferta', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [{ id: 'w-1' }], error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });
    const result = await listWaitlistByOferta('of-1');
    expect(result).toHaveLength(1);
  });

  it('listWaitlistByProcura', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [{ id: 'w-1', procura_id: 'pr-1', estado: 'activa' }],
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });
    const result = await listWaitlistByProcura('pr-1');
    expect(result).toHaveLength(1);
    expect(result[0].estado).toBe('activa');
  });

  describe('promoteWaitlist', () => {
    it('chama RPC e devolve entrada notificada (sem auto-aceitar)', async () => {
      supabase.rpc.mockResolvedValue({ data: 'w-1', error: null });

      const result = await promoteWaitlist('of-1');

      expect(supabase.rpc).toHaveBeenCalledWith('promote_waitlist', {
        p_oferta_id: 'of-1',
      });
      expect(result).toEqual({
        id: 'w-1',
        oferta_id: 'of-1',
        estado: 'notificada',
      });
      expect(supabase.from).not.toHaveBeenCalledWith('acordos');
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        'accept_proposal',
        expect.anything(),
      );
    });

    it('devolve null quando não há candidatos activos', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await promoteWaitlist('of-1');

      expect(result).toBeNull();
    });

    it('exige oferta_id', async () => {
      await expect(promoteWaitlist()).rejects.toThrow(/oferta_id/i);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('propaga erro da RPC', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Sem permissão para promover a lista de espera desta oferta.' },
      });

      await expect(promoteWaitlist('of-1')).rejects.toThrow(/permissão/i);
    });
  });
});
