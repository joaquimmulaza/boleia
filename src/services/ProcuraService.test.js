import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createProcura,
  createProcuraWithGrupo,
  listProcurasByOwner,
  getProcura,
} from './ProcuraService.js';
import {
  createGrupo,
  addMembroGrupo,
  syncNCandidato,
  getGrupoByProcura,
  listMembrosGrupo,
} from './GrupoService.js';
import { supabase } from '../lib/supabase';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
    rpc: vi.fn(),
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
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'pr-1',
            owner_id: 'pax-1',
            n_candidato: 1,
            estado: 'activa',
            dias_semana: [1, 2, 3, 4, 5],
          },
          error: null,
        }),
      }),
    });
    supabase.from.mockReturnValue({
      insert: mockInsert,
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
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        n_candidato: 1,
        dias_semana: [1, 2, 3, 4, 5],
      }),
    ]);
    expect(result.n_candidato).toBe(1);
  });

  it('createProcura grava dias_semana fornecidos (não só o default Seg–Sex)', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-1' } },
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'pr-2',
            owner_id: 'pax-1',
            dias_semana: [1, 3, 5],
          },
          error: null,
        }),
      }),
    });
    supabase.from.mockReturnValue({ insert: mockInsert });

    await createProcura({
      preferred_time: '07:00',
      dias_semana: [1, 3, 5],
    });

    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({ dias_semana: [1, 3, 5] }),
    ]);
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

  it('createProcuraWithGrupo chama RPC atómica com procura+grupo+membro', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-1' } },
    });
    supabase.rpc.mockResolvedValue({
      data: {
        id: 'pr-grupo',
        owner_id: 'pax-1',
        n_candidato: 1,
        estado: 'activa',
      },
      error: null,
    });

    const result = await createProcuraWithGrupo(
      {
        preferred_time: '07:15',
        origin_name: 'Talatona',
        origin_lat: -8.9,
        origin_lng: 13.3,
        destination_name: 'Miramar',
        destination_lat: -8.81,
        destination_lng: 13.23,
        dias_semana: [1, 2, 3, 4, 5],
        teto_mensal_kz: 50000,
      },
      {
        nome: 'O meu grupo',
        nMaximo: 5,
        pickup_name: 'Talatona',
        pickup_lat: -8.9,
        pickup_lng: 13.3,
        dropoff_name: 'Miramar',
        dropoff_lat: -8.81,
        dropoff_lng: 13.23,
      },
    );

    expect(supabase.rpc).toHaveBeenCalledWith(
      'create_procura_with_grupo',
      expect.objectContaining({
        p_preferred_time: '07:15',
        p_grupo_nome: 'O meu grupo',
        p_n_maximo: 5,
        p_pickup_name: 'Talatona',
        p_dropoff_name: 'Miramar',
        p_teto_mensal_kz: 50000,
      }),
    );
    expect(result.id).toBe('pr-grupo');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('createProcuraWithGrupo propaga erro da RPC sem insert client', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-1' } },
    });
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Falha ao criar grupo.' },
    });

    await expect(
      createProcuraWithGrupo({ preferred_time: '07:15' }, { nMaximo: 5 }),
    ).rejects.toEqual({ message: 'Falha ao criar grupo.' });
    expect(supabase.from).not.toHaveBeenCalled();
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
      data: { id: 'g-1', procura_id: 'pr-1', n_maximo: 4 },
      error: null,
    });

    let membrosFromCalls = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: mockGrupoSingle }),
          }),
        };
      }
      if (table === 'membros_grupo') {
        membrosFromCalls += 1;
        if (membrosFromCalls === 1) {
          // assertTemVaga: count activos
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        if (membrosFromCalls === 2) {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockMembroSingle }),
            }),
          };
        }
        // syncNCandidato count
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
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

  it('getGrupoByProcura devolve o grupo ligado à procura', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'g-1', procura_id: 'pr-1', nome: 'Colegas' },
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle }),
      }),
    });

    const grupo = await getGrupoByProcura('pr-1');
    expect(supabase.from).toHaveBeenCalledWith('grupos');
    expect(grupo.id).toBe('g-1');
  });

  it('getGrupoByProcura devolve null quando não há grupo', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const grupo = await getGrupoByProcura('pr-1');
    expect(grupo).toBeNull();
  });

  it('listMembrosGrupo lista membros activos com perfil', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm-1',
          passenger_id: 'pax-1',
          estado: 'activo',
          ordem_insercao: 0,
          pickup_name: 'Talatona',
          perfis: { nome_completo: 'Ana', telefone: '+244923000001' },
        },
        {
          id: 'm-2',
          passenger_id: 'pax-2',
          estado: 'activo',
          ordem_insercao: 1,
          pickup_name: 'Benfica',
          perfis: { nome_completo: 'Bruno', telefone: '+244923000002' },
        },
      ],
      error: null,
    });
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: mockOrder,
          }),
        }),
      }),
    });

    const membros = await listMembrosGrupo('g-1');
    expect(supabase.from).toHaveBeenCalledWith('membros_grupo');
    expect(membros).toHaveLength(2);
    expect(membros[1].perfis.nome_completo).toBe('Bruno');
  });
});
