import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProcura,
  listProcurasByOwner,
  getProcura,
} from './ProcuraService.js';
import {
  createGrupo,
  addMembroGrupo,
  syncNCandidato,
} from './GrupoService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('ProcuraService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createProcura cria procura individual com N_candidato = 1', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-1' } },
    });
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'pr-1', owner_id: 'pax-1', n_candidato: 1, estado: 'activa' },
      error: null,
    });
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });

    const result = await createProcura({
      preferred_time: '07:10',
      origin_name: 'Viana',
      origin_lat: -8.9,
      origin_lng: 13.3,
      destination_name: 'Ingombota',
      destination_lat: -8.81,
      destination_lng: 13.23,
    });

    expect(supabase.from).toHaveBeenCalledWith('procuras');
    expect(result.n_candidato).toBe(1);
  });

  it('createProcura rejeita sem autenticação', async () => {
    supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    await expect(createProcura({ preferred_time: '07:00' })).rejects.toThrow(
      'Não autenticado',
    );
  });

  it('listProcurasByOwner filtra por owner', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: mockOrder }),
      }),
    });
    await listProcurasByOwner('pax-1');
    expect(supabase.from).toHaveBeenCalledWith('procuras');
  });

  it('getProcura devolve por id', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: 'pr-1' }, error: null }),
        }),
      }),
    });
    const result = await getProcura('pr-1');
    expect(result.id).toBe('pr-1');
  });
});

describe('GrupoService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createGrupo liga grupo à procura', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'g-1', procura_id: 'pr-1', nome: 'Colegas Talatona' },
      error: null,
    });
    supabase.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    const result = await createGrupo('pr-1', 'Colegas Talatona');
    expect(result.procura_id).toBe('pr-1');
  });

  it('addMembroGrupo insere membro e sincroniza N_candidato', async () => {
    const mockMembroSingle = vi.fn().mockResolvedValue({
      data: { id: 'm-1', grupo_id: 'g-1', passenger_id: 'pax-2', estado: 'activo' },
      error: null,
    });
    const mockGrupoSingle = vi.fn().mockResolvedValue({
      data: { id: 'g-1', procura_id: 'pr-1' },
      error: null,
    });
    const mockCount = vi.fn().mockResolvedValue({ count: 2, error: null });
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockInvalidate = vi.fn().mockResolvedValue({ error: null });

    supabase.from.mockImplementation((table) => {
      if (table === 'membros_grupo') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockMembroSingle }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue(mockCount()),
            }),
          }),
        };
      }
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockGrupoSingle }),
          }),
        };
      }
      if (table === 'procuras') {
        return {
          update: vi.fn().mockReturnValue({ eq: mockUpdateEq }),
        };
      }
      if (table === 'propostas') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: mockInvalidate }),
          }),
        };
      }
      return {};
    });

    // Simpler path: mock syncNCandidato internals carefully via addMembro
    // Re-mock with clearer chain for count
    let callCount = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'membros_grupo' && callCount === 0) {
        callCount += 1;
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockMembroSingle }),
          }),
        };
      }
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockGrupoSingle }),
          }),
        };
      }
      if (table === 'membros_grupo') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation(() => ({
              eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
            })),
          }),
        };
      }
      if (table === 'procuras') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'propostas') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await addMembroGrupo('g-1', {
      passenger_id: 'pax-2',
      pickup_name: 'Casa',
      ordem_insercao: 1,
    });
    expect(result.passenger_id).toBe('pax-2');
  });

  it('syncNCandidato actualiza procura com COUNT activos', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', procura_id: 'pr-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'membros_grupo') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
            }),
          }),
        };
      }
      if (table === 'procuras') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'propostas') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const n = await syncNCandidato('g-1');
    expect(n).toBe(3);
  });
});
