import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findCompatibleOfertas, findCompatibleProcuras } from './MatchingService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('MatchingService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('findCompatibleProcuras classifica procuras para oferta fixa (integração real)', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'pr-1',
              preferred_time: '07:10',
              n_candidato: 2,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.8473,
              origin_lng: 13.2344,
              destination_lat: -8.855,
              destination_lng: 13.255,
            },
            {
              id: 'pr-2',
              preferred_time: '07:05',
              n_candidato: 4,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.8473,
              origin_lng: 13.2344,
              destination_lat: -8.855,
              destination_lng: 13.255,
            },
            {
              id: 'pr-longe',
              preferred_time: '07:05',
              n_candidato: 1,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.95,
              origin_lng: 13.1,
              destination_lat: -8.9,
              destination_lng: 13.15,
            },
          ],
          error: null,
        }),
      }),
    });

    const oferta = {
      departure_time: '07:00',
      origin_lat: -8.8383,
      origin_lng: 13.2344,
      destination_lat: -8.85,
      destination_lng: 13.25,
      vagas_disponiveis: 3,
      flexibilidade_rota: false,
      dias_semana: [1, 2, 3, 4, 5],
    };

    const result = await findCompatibleProcuras(oferta);

    expect(result.direct.map((p) => p.id)).toEqual(['pr-1']);
    expect(result.waitlist.map((p) => p.id)).toEqual(['pr-2']);
    expect(result.incompatible.map((p) => p.id)).toEqual(['pr-longe']);
  });

  it('findCompatibleProcuras casa oferta flexível sem OD por tempo/capacidade (integração real)', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'pr-flex-1',
              preferred_time: '07:10',
              n_candidato: 2,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.95,
              origin_lng: 13.1,
              destination_lat: -8.9,
              destination_lng: 13.15,
            },
            {
              id: 'pr-flex-2',
              preferred_time: '07:05',
              n_candidato: 5,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.95,
              origin_lng: 13.1,
              destination_lat: -8.9,
              destination_lng: 13.15,
            },
            {
              id: 'pr-hora-fora',
              preferred_time: '09:00',
              n_candidato: 1,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.95,
              origin_lng: 13.1,
              destination_lat: -8.9,
              destination_lng: 13.15,
            },
          ],
          error: null,
        }),
      }),
    });

    const result = await findCompatibleProcuras({
      flexibilidade_rota: true,
      departure_time: '07:00',
      vagas_disponiveis: 3,
      dias_semana: [1, 2, 3, 4, 5],
      origin_lat: null,
      origin_lng: null,
      destination_lat: null,
      destination_lng: null,
    });

    expect(supabase.from).toHaveBeenCalledWith('procuras');
    expect(result.direct.map((p) => p.id)).toEqual(['pr-flex-1']);
    expect(result.waitlist.map((p) => p.id)).toEqual(['pr-flex-2']);
    expect(result.incompatible.map((p) => p.id)).toEqual(['pr-hora-fora']);
  });

  it('findCompatibleProcuras: oferta fixa sem OD completa devolve buckets vazios', async () => {
    const result = await findCompatibleProcuras({
      flexibilidade_rota: false,
      departure_time: '07:00',
      vagas_disponiveis: 3,
      origin_lat: null,
      origin_lng: null,
      destination_lat: null,
      destination_lng: null,
    });

    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toEqual({ direct: [], waitlist: [], incompatible: [] });
  });

  it('findCompatibleOfertas passa flexibilidade_rota e casa flex sem geo', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'of-flex',
              departure_time: '07:00',
              vagas_disponiveis: 3,
              flexibilidade_rota: true,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: null,
              origin_lng: null,
              destination_lat: null,
              destination_lng: null,
            },
            {
              id: 'of-fixa-longe',
              departure_time: '07:00',
              vagas_disponiveis: 3,
              flexibilidade_rota: false,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.8383,
              origin_lng: 13.2344,
              destination_lat: -8.85,
              destination_lng: 13.25,
            },
          ],
          error: null,
        }),
      }),
    });

    const result = await findCompatibleOfertas({
      preferred_time: '07:10',
      origin_lat: -8.95,
      origin_lng: 13.1,
      destination_lat: -8.9,
      destination_lng: 13.15,
      n_candidato: 2,
      dias_semana: [1, 2],
    });

    expect(result.direct.map((o) => o.id)).toEqual(['of-flex']);
    expect(result.incompatible.map((o) => o.id)).toEqual(['of-fixa-longe']);
  });

  it('classifica ofertas em direct / waitlist / incompatíveis (integração real)', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'of-1',
              departure_time: '07:00',
              vagas_disponiveis: 3,
              flexibilidade_rota: false,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.8383,
              origin_lng: 13.2344,
              destination_lat: -8.85,
              destination_lng: 13.25,
            },
            {
              id: 'of-2',
              departure_time: '07:00',
              vagas_disponiveis: 1,
              flexibilidade_rota: false,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.8383,
              origin_lng: 13.2344,
              destination_lat: -8.85,
              destination_lng: 13.25,
            },
            {
              id: 'of-3',
              departure_time: '09:00',
              vagas_disponiveis: 4,
              flexibilidade_rota: false,
              dias_semana: [1, 2, 3, 4, 5],
              origin_lat: -8.8383,
              origin_lng: 13.2344,
              destination_lat: -8.85,
              destination_lng: 13.25,
            },
          ],
          error: null,
        }),
      }),
    });

    const procura = {
      preferred_time: '07:10',
      origin_lat: -8.8473,
      origin_lng: 13.2344,
      destination_lat: -8.855,
      destination_lng: 13.255,
      n_candidato: 3,
      dias_semana: [1, 2, 3, 4, 5],
    };

    const result = await findCompatibleOfertas(procura);

    expect(result.direct.map((o) => o.id)).toEqual(['of-1']);
    expect(result.waitlist.map((o) => o.id)).toEqual(['of-2']);
    expect(result.incompatible.map((o) => o.id)).toEqual(['of-3']);
  });

  it('procura sem dias_semana fica incompatível (exige intersecção real)', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: 'of-ok',
              departure_time: '07:00',
              vagas_disponiveis: 3,
              flexibilidade_rota: true,
              dias_semana: [1, 2, 3, 4, 5],
            },
          ],
          error: null,
        }),
      }),
    });

    const result = await findCompatibleOfertas({
      preferred_time: '07:10',
      n_candidato: 1,
      dias_semana: null,
    });

    expect(result.incompatible.map((o) => o.id)).toEqual(['of-ok']);
    expect(result.direct).toEqual([]);
  });

  it('bidireccional: dias sem intersecção exclui nos dois sentidos', async () => {
    const procuraRow = {
      id: 'pr-dias',
      preferred_time: '07:10',
      n_candidato: 1,
      dias_semana: [6, 7],
      origin_lat: -8.8473,
      origin_lng: 13.2344,
      destination_lat: -8.855,
      destination_lng: 13.255,
    };
    const ofertaRow = {
      id: 'of-dias',
      departure_time: '07:00',
      vagas_disponiveis: 3,
      flexibilidade_rota: true,
      dias_semana: [1, 2, 3, 4, 5],
      origin_lat: null,
      origin_lng: null,
      destination_lat: null,
      destination_lng: null,
    };

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [procuraRow], error: null }),
      }),
    });
    const b = await findCompatibleProcuras(ofertaRow);
    expect(b.incompatible.map((p) => p.id)).toEqual(['pr-dias']);

    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [ofertaRow], error: null }),
      }),
    });
    const a = await findCompatibleOfertas(procuraRow);
    expect(a.incompatible.map((o) => o.id)).toEqual(['of-dias']);
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
