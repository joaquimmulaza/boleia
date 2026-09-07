/**
 * PACOTE ENG #12 — solicitar entrada → owner aceita/rejeita; sem auto-aprovação.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  pedirEntradaGrupo,
  aprovarEntrada,
  rejeitarEntrada,
  addMembroGrupo,
  syncNCandidato,
} from './GrupoService.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

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

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('PACOTE ENG #12 — pedido de entrada sem auto-aprovação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('1 — Solicitar entrada cria pedido pendente', () => {
    it('pedirEntradaGrupo insere estado pendente e não actualiza procuras', async () => {
      /** @type {object | null} */
      let insertPayload = null;
      let membrosCalls = 0;

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
          membrosCalls += 1;
          if (membrosCalls === 1) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
                }),
              }),
            };
          }
          if (membrosCalls === 2) {
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
                    data: { id: 'm-p', ...insertPayload },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }
        return {};
      });

      const pedido = await pedirEntradaGrupo('g-1', { passenger_id: 'pax-2' });

      expect(insertPayload?.estado).toBe('pendente');
      expect(pedido.estado).toBe('pendente');
      expect(supabase.from).not.toHaveBeenCalledWith('procuras');
    });
  });

  describe('2 — Owner aceita ou rejeita', () => {
    it('aprovarEntrada activa membro e sincroniza N_actual', async () => {
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
          if (membrosStep === 2 || membrosStep === 4) {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({
                    count: membrosStep === 2 ? 1 : 2,
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
                    data: { id: 'm-p', estado: 'activo', grupo_id: 'g-1' },
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
    });

    it('rejeitarEntrada marca rejeitado sem sync N', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'owner-1' } },
        error: null,
      });

      let step = 0;
      supabase.from.mockImplementation((table) => {
        if (table === 'membros_grupo') {
          step += 1;
          if (step === 1) {
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
                    data: { id: 'm-p', estado: 'rejeitado' },
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
      expect(supabase.from).not.toHaveBeenCalledWith('procuras');
    });
  });

  describe('3 — Sem auto-aprovação / atalho ilegal', () => {
    it('passageiro não pode aprovar o próprio pedido', async () => {
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

    it('addMembroGrupo exige organizador (sem join directo por passageiro)', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'pax-intruso' } },
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
        addMembroGrupo('g-1', { passenger_id: 'pax-vitima', ordem_insercao: 1 }),
      ).rejects.toThrow(/organizador/i);
    });

    it('RLS INSERT self só permite estado pendente', () => {
      const sql = readMigration('20260906091929_audit_gaps_rls_membros_and_adenda_estados.sql');
      expect(sql).toMatch(/membros_insert_envolvidos/);
      expect(sql).toMatch(/lower\(estado\)\s*=\s*'pendente'/);
    });

    it('RLS UPDATE owner gere; self só reabre pendente (nunca activo)', () => {
      const sql = readMigration('20260905111441_marketplace_p0_hardening_leave_rls.sql');
      expect(sql).toMatch(/membros_update_owner/);
      expect(sql).toMatch(/membros_update_self_reabrir_pendente/);
      expect(sql).toMatch(/lower\(estado\)\s*=\s*'pendente'/);
    });
  });

  describe('4 — Snapshots imutáveis (sync não muta propostas)', () => {
    it('syncNCandidato nunca chama UPDATE em propostas', async () => {
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
        if (table === 'propostas') {
          throw new Error('syncNCandidato não deve mutar propostas');
        }
        return {};
      });

      await syncNCandidato('g-1');
      expect(supabase.from).not.toHaveBeenCalledWith('propostas');
    });
  });
});
