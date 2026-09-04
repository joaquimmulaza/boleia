import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findCompatibleOfertas } from './MatchingService.js';
import { enqueueWaitlist, listWaitlistByOferta } from './WaitlistService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../utils/matchingFilters', () => ({
  evaluateMatch: vi.fn(),
}));

import { evaluateMatch } from '../utils/matchingFilters';

describe('MatchingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifica ofertas em direct / waitlist / incompatíveis', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            { id: 'of-1', departure_time: '07:00', vagas_disponiveis: 3, origin_lat: -8.8, origin_lng: 13.2, destination_lat: -8.85, destination_lng: 13.25 },
            { id: 'of-2', departure_time: '07:00', vagas_disponiveis: 1, origin_lat: -8.8, origin_lng: 13.2, destination_lat: -8.85, destination_lng: 13.25 },
            { id: 'of-3', departure_time: '09:00', vagas_disponiveis: 4, origin_lat: -8.8, origin_lng: 13.2, destination_lat: -8.85, destination_lng: 13.25 },
          ],
          error: null,
        }),
      }),
    });

    evaluateMatch
      .mockReturnValueOnce('direct')
      .mockReturnValueOnce('waitlist')
      .mockReturnValueOnce('incompatible');

    const procura = {
      preferred_time: '07:10',
      origin_lat: -8.81,
      origin_lng: 13.21,
      destination_lat: -8.86,
      destination_lng: 13.26,
      n_candidato: 3,
    };

    const result = await findCompatibleOfertas(procura);

    expect(result.direct).toHaveLength(1);
    expect(result.direct[0].id).toBe('of-1');
    expect(result.waitlist).toHaveLength(1);
    expect(result.waitlist[0].id).toBe('of-2');
    expect(result.incompatible).toHaveLength(1);
  });

  it('propaga erro do Supabase', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
      }),
    });
    await expect(
      findCompatibleOfertas({ preferred_time: '07:00', n_candidato: 1 }),
    ).rejects.toEqual({ message: 'fail' });
  });
});

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
});
