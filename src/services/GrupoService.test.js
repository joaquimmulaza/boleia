import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../lib/supabase';
import {
  createGrupo,
  addMembroGrupo,
  syncNCandidato,
  listGruposAbertos,
  pedirEntradaGrupo,
  listPedidosPendentes,
  aprovarEntrada,
  rejeitarEntrada,
} from './GrupoService';

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('GrupoService T31 — n_maximo e pedidos de entrada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createGrupo persiste n_maximo (capacidade pretendida)', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: { id: 'g-1', procura_id: 'pr-1', nome: 'Colegas', n_maximo: 4 },
      error: null,
    });
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    });
    supabase.from.mockReturnValue({ insert: mockInsert });

    const result = await createGrupo('pr-1', 'Colegas', 4);

    expect(supabase.from).toHaveBeenCalledWith('grupos');
    expect(mockInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        procura_id: 'pr-1',
        nome: 'Colegas',
        n_maximo: 4,
      }),
    ]);
    expect(result.n_maximo).toBe(4);
  });

  it('createGrupo rejeita n_maximo fora de 2–8', async () => {
    await expect(createGrupo('pr-1', 'X', 1)).rejects.toThrow(/capacidade/i);
    await expect(createGrupo('pr-1', 'X', 9)).rejects.toThrow(/capacidade/i);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('addMembroGrupo falha quando o grupo já está completo', async () => {
    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', n_maximo: 2, procura_id: 'pr-1' },
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
              eq: vi.fn().mockResolvedValue({ count: 2, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      addMembroGrupo('g-1', { passenger_id: 'pax-3', ordem_insercao: 2 }),
    ).rejects.toThrow(/completo/i);
  });

  it('listGruposAbertos devolve grupos com vagas (N_actual < n_maximo)', async () => {
    const rows = [
      {
        id: 'g-1',
        n_maximo: 4,
        nome: 'Colegas',
        procura_id: 'pr-1',
        procuras: {
          id: 'pr-1',
          owner_id: 'owner-1',
          origin_name: 'Talatona',
          destination_name: 'Mutual',
          preferred_time: '07:15:00',
          n_candidato: 2,
          estado: 'activa',
        },
      },
      {
        id: 'g-full',
        n_maximo: 2,
        procura_id: 'pr-full',
        procuras: {
          owner_id: 'other',
          n_candidato: 2,
          estado: 'activa',
        },
      },
    ];
    supabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: rows, error: null }),
    });

    const lista = await listGruposAbertos({ excludeOwnerId: 'me' });
    expect(supabase.from).toHaveBeenCalledWith('grupos');
    expect(lista).toHaveLength(1);
    expect(lista[0].n_maximo).toBe(4);
    expect(lista[0].procuras.n_candidato).toBe(2);
  });

  it('pedirEntradaGrupo cria membro pendente sem sincronizar N_actual', async () => {
    const mockInsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'm-pend',
        grupo_id: 'g-1',
        passenger_id: 'pax-2',
        estado: 'pendente',
      },
      error: null,
    });

    let membrosFromCalls = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', n_maximo: 4, procura_id: 'pr-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'membros_grupo') {
        membrosFromCalls += 1;
        if (membrosFromCalls === 1) {
          // assertTemVaga count
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        if (membrosFromCalls === 2) {
          // existing member check
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: mockInsertSingle }),
          }),
        };
      }
      return {};
    });

    const pedido = await pedirEntradaGrupo('g-1', {
      passenger_id: 'pax-2',
      pickup_name: 'Benfica',
    });

    expect(pedido.estado).toBe('pendente');
    const procuraCalls = supabase.from.mock.calls.filter((c) => c[0] === 'procuras');
    expect(procuraCalls).toHaveLength(0);
  });

  it('listPedidosPendentes lista só estado pendente', async () => {
    const mockOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'm-p',
          passenger_id: 'pax-2',
          estado: 'pendente',
          perfis: { nome_completo: 'Bruno' },
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

    const pedidos = await listPedidosPendentes('g-1');
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].estado).toBe('pendente');
  });

  it('aprovarEntrada activa membro, sincroniza N e não toca propostas', async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({
      data: {
        id: 'm-p',
        grupo_id: 'g-1',
        passenger_id: 'pax-2',
        estado: 'activo',
      },
      error: null,
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'membros_grupo') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'm-p',
                  grupo_id: 'g-1',
                  passenger_id: 'pax-2',
                  estado: 'pendente',
                },
                error: null,
              }),
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({ single: mockUpdateEq }),
            }),
          }),
        };
      }
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', n_maximo: 4, procura_id: 'pr-1' },
                error: null,
              }),
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

    // Simpler dedicated mock chain for approve
    let step = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'membros_grupo' && step === 0) {
        step = 1;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'm-p',
                  grupo_id: 'g-1',
                  passenger_id: 'pax-2',
                  estado: 'pendente',
                  ordem_insercao: 1,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', n_maximo: 4, procura_id: 'pr-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'membros_grupo' && step === 1) {
        // count activos
        step = 2;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
        };
      }
      if (table === 'membros_grupo' && step === 2) {
        step = 3;
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'm-p',
                    grupo_id: 'g-1',
                    passenger_id: 'pax-2',
                    estado: 'activo',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // syncNCandidato
      if (table === 'membros_grupo') {
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

    const aprovado = await aprovarEntrada('m-p');
    expect(aprovado.estado).toBe('activo');
    const propostasCalls = supabase.from.mock.calls.filter((c) => c[0] === 'propostas');
    expect(propostasCalls).toHaveLength(0);
  });

  it('rejeitarEntrada marca pedido como rejeitado sem sync N', async () => {
    let step = 0;
    supabase.from.mockImplementation(() => {
      if (step === 0) {
        step = 1;
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'm-p', estado: 'pendente' },
                error: null,
              }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'm-p', estado: 'rejeitado', grupo_id: 'g-1' },
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const rej = await rejeitarEntrada('m-p');
    expect(rej.estado).toBe('rejeitado');
    expect(supabase.from).toHaveBeenCalledWith('membros_grupo');
    expect(supabase.from).not.toHaveBeenCalledWith('procuras');
  });

  it('rejeitarEntrada falha se o pedido já não está pendente', async () => {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'm-p', estado: 'activo' },
            error: null,
          }),
        }),
      }),
    });

    await expect(rejeitarEntrada('m-p')).rejects.toThrow(/já não está pendente/i);
  });

  it('syncNCandidato continua a contar só membros activos', async () => {
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

    const n = await syncNCandidato('g-1');
    expect(n).toBe(2);
  });
});
