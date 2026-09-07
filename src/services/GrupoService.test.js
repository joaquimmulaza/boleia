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
  sairDoGrupo,
} from './GrupoService';

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

describe('GrupoService T31 — n_maximo e pedidos de entrada', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'jwt-test' } },
    });
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
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', n_maximo: 2, procura_id: 'pr-1', procuras: { owner_id: 'owner-1' } },
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

  it('addMembroGrupo com pickup vazio ou apenas espaços persiste pickup como null', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    let insertedPayload = null;
    let membrosCalls = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'g-1', procura_id: 'pr-1', n_maximo: 4, procuras: { owner_id: 'owner-1' } },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'membros_grupo') {
        membrosCalls += 1;
        if (membrosCalls === 1) {
          // assertTemVaga
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        if (membrosCalls === 2) {
          // insert
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedPayload = payload[0];
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: 'm-2', ...payload[0] },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        // syncNCandidato
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
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      return {};
    });

    const membroCriado = await addMembroGrupo('g-1', {
      passenger_id: 'pax-2',
      pickup_name: '   ',
      pickup_lat: '',
      pickup_lng: null,
      ordem_insercao: 1,
    });

    expect(insertedPayload.pickup_name).toBeNull();
    expect(insertedPayload.pickup_lat).toBeNull();
    expect(insertedPayload.pickup_lng).toBeNull();
    expect(membroCriado.pickup_name).toBeNull();
  });

  it('pedirEntradaGrupo com pickup vazio ou espaços persiste pickup como null', async () => {
    let insertedPayload = null;
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
              mockResolvedValue: vi.fn().mockResolvedValue({ count: 1, error: null }),
            }),
          }),
          insert: vi.fn().mockImplementation((payload) => {
            insertedPayload = payload[0];
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'm-p', ...payload[0] },
                  error: null,
                }),
              }),
            };
          }),
        };
      }
      return {};
    });

    await pedirEntradaGrupo('g-1', {
      passenger_id: 'pax-2',
      pickup_name: '',
    });

    expect(insertedPayload.pickup_name).toBeNull();
    expect(insertedPayload.pickup_lat).toBeNull();
    expect(insertedPayload.pickup_lng).toBeNull();
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
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    let membrosCalls = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'membros_grupo') {
        membrosCalls += 1;
        if (membrosCalls === 1) {
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
        if (membrosCalls === 2 || membrosCalls === 4) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  count: membrosCalls === 2 ? 1 : 2,
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
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'g-1',
                  n_maximo: 4,
                  procura_id: 'pr-1',
                  procuras: { owner_id: 'owner-1' },
                },
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

    const aprovado = await aprovarEntrada('m-p');
    expect(aprovado.estado).toBe('activo');
    const propostasCalls = supabase.from.mock.calls.filter((c) => c[0] === 'propostas');
    expect(propostasCalls).toHaveLength(0);
  });

  it('aprovarEntrada rejeita se o utilizador não é o organizador', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'intruso' } },
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
                  passenger_id: 'intruso',
                  estado: 'pendente',
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
                data: {
                  id: 'g-1',
                  procura_id: 'pr-1',
                  procuras: { owner_id: 'owner-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(aprovarEntrada('m-p')).rejects.toThrow(/organizador/i);
  });

  it('rejeitarEntrada marca pedido como rejeitado sem sync N', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'owner-1' } },
      error: null,
    });

    let membrosStep = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'membros_grupo') {
        membrosStep += 1;
        if (membrosStep === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'm-p', grupo_id: 'g-1', estado: 'pendente' },
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
      }
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'g-1',
                  procura_id: 'pr-1',
                  procuras: { owner_id: 'owner-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
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

  it('sairDoGrupo chama RPC leave_grupo_membro com p_idempotency_key e não toca propostas', async () => {
    supabase.rpc.mockResolvedValue({
      data: {
        id: 'm-2',
        grupo_id: 'g-1',
        passenger_id: 'pax-2',
        estado: 'saiu',
      },
      error: null,
    });

    const saiu = await sairDoGrupo('g-1', 'pax-2');

    expect(supabase.rpc).toHaveBeenCalledWith(
      'leave_grupo_membro',
      expect.objectContaining({
        p_grupo_id: 'g-1',
        p_passenger_id: 'pax-2',
        p_idempotency_key: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    );
    expect(saiu.estado).toBe('saiu');
    expect(supabase.from).not.toHaveBeenCalled();
    const propostasCalls = supabase.from.mock.calls.filter((c) => c[0] === 'propostas');
    expect(propostasCalls).toHaveLength(0);
  });

  it('sairDoGrupo em falha de rede enfileira leave_grupo_membro e devolve offlineQueued', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    const result = await sairDoGrupo('g-1', 'pax-2');

    expect(result.offlineQueued).toBe(true);
    expect(result.idempotency_key).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('sairDoGrupo propaga erro da RPC (ex. único membro activo)', async () => {
    supabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Não podes sair: és o único membro activo do grupo.' },
    });

    await expect(sairDoGrupo('g-1', 'pax-1')).rejects.toThrow(/único membro/i);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'leave_grupo_membro',
      expect.objectContaining({
        p_grupo_id: 'g-1',
        p_passenger_id: 'pax-1',
        p_idempotency_key: expect.any(String),
      }),
    );
  });

  it('sairDoGrupo exige grupoId e passengerId', async () => {
    await expect(sairDoGrupo('', 'pax-1')).rejects.toThrow(/grupo/i);
    await expect(sairDoGrupo('g-1', '')).rejects.toThrow(/passageiro/i);
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it('aprovarEntrada nunca auto-aprova sem ser organizador (P0)', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-2' } },
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
            }),
          }),
        };
      }
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'g-1',
                  procura_id: 'pr-1',
                  procuras: { owner_id: 'owner-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(aprovarEntrada('m-p')).rejects.toThrow(/organizador/i);
  });
});

describe('GrupoService — Task 2 hardening joins (estado activo)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  it("insert de membro com estado 'activo' pelo papel passageiro falha ou força 'pendente'", async () => {
    /** @type {object | null} */
    let insertPayload = null;
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
          insert: vi.fn().mockImplementation((rows) => {
            insertPayload = rows?.[0] ?? null;
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'm-pend',
                    grupo_id: 'g-1',
                    passenger_id: 'pax-pass',
                    estado: 'pendente',
                  },
                  error: null,
                }),
              }),
            };
          }),
        };
      }
      return {};
    });

    // Self-join (papel passageiro): payload nunca pode ir como 'activo'.
    const pedido = await pedirEntradaGrupo('g-1', { passenger_id: 'pax-pass' });
    expect(insertPayload).toEqual(
      expect.objectContaining({
        passenger_id: 'pax-pass',
        estado: 'pendente',
      }),
    );
    expect(insertPayload?.estado).not.toBe('activo');
    expect(pedido.estado).toBe('pendente');

    // Bypass: insert com activo rejeitado por RLS / guard owner — erro propaga.
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'pax-pass' } },
      error: null,
    });
    let bypassCalls = 0;
    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'g-1',
                  n_maximo: 4,
                  procura_id: 'pr-1',
                  procuras: { owner_id: 'owner-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'membros_grupo') {
        bypassCalls += 1;
        if (bypassCalls === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
              }),
            }),
          };
        }
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: {
                  code: '42501',
                  message:
                    'new row violates row-level security policy for table "membros_grupo"',
                },
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      addMembroGrupo('g-1', { passenger_id: 'pax-pass', ordem_insercao: 1 }),
    ).rejects.toThrow(/organizador/i);
  });

  it('addMembroGrupo exige organizador antes de insert directo activo', async () => {
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'intruso' } },
      error: null,
    });

    supabase.from.mockImplementation((table) => {
      if (table === 'grupos') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'g-1',
                  n_maximo: 4,
                  procura_id: 'pr-1',
                  procuras: { owner_id: 'owner-1' },
                },
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    await expect(
      addMembroGrupo('g-1', { passenger_id: 'pax-2', ordem_insercao: 1 }),
    ).rejects.toThrow(/organizador/i);
  });
});

describe('GrupoService — Task 5 snapshot N_proposto imutável', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('após syncNCandidato por crescimento do grupo, n_passageiros_propostos das propostas existentes permanece intacto', async () => {
    // Snapshot congelado na proposta (N_proposto=2) antes do grupo crescer para 3 activos.
    const propostasExistentes = [
      {
        id: 'prop-snap',
        grupo_id: 'g-1',
        n_passageiros_propostos: 2,
        estado: 'aberta',
      },
    ];
    const nPropostoAntes = propostasExistentes[0].n_passageiros_propostos;

    const mockProcuraUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockPropostasUpdate = vi.fn();

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
        return { update: mockProcuraUpdate };
      }
      if (table === 'propostas') {
        return { update: mockPropostasUpdate };
      }
      return {};
    });

    const n = await syncNCandidato('g-1');

    expect(n).toBe(3);
    expect(mockProcuraUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ n_candidato: 3 }),
    );
    // sync só actualiza procura — nunca muta propostas / N_proposto.
    expect(supabase.from).not.toHaveBeenCalledWith('propostas');
    expect(mockPropostasUpdate).not.toHaveBeenCalled();
    expect(propostasExistentes[0].n_passageiros_propostos).toBe(nPropostoAntes);
    expect(propostasExistentes[0].n_passageiros_propostos).toBe(2);
  });
});
