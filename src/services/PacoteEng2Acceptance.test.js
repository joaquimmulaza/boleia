/**
 * PACOTE ENG #2 — critérios de aceitação (M propostas + snapshots imutáveis).
 * Reutiliza serviços/RPC/RLS existentes; valida contrato público + invariantes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProposta, listPropostasByProcura, rejectProposta } from './PropostaService.js';
import { createAgreementFromProposal } from './AgreementService.js';
import { syncNCandidato } from './GrupoService.js';
import { buildPropostaReview } from '../utils/propostaReview.js';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import {
  filterPropostasParaInbox,
  filterPropostasEnviadas,
  resolvePropostaInbox,
} from '../utils/propostaInbox.js';
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

describe('PACOTE ENG #2 — aceitação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('1 — Grupo vivo incompleto pode receber propostas', () => {
    it('createProposta aceita N_actual=2 com grupo_id mesmo abaixo de n_maximo conceptual', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'pax-owner' } },
      });
      const mockSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'prop-incompleto',
          grupo_id: 'g-1',
          n_passageiros_propostos: 2,
          estado: 'aberta',
          modo_preco: 'TOTAL_ACORDO',
          valor_mensal_ask_kz: 80000,
          created_by: 'pax-owner',
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
        valor_mensal_ask_kz: 80000,
        n_passageiros_propostos: 2,
      });

      expect(result.n_passageiros_propostos).toBe(2);
      expect(result.estado).toBe('aberta');
    });
  });

  describe('2 — Crescimento do grupo não reescreve snapshots (nova versão)', () => {
    it('syncNCandidato actualiza n_candidato mas nunca chama UPDATE em propostas', async () => {
      const propostaAntiga = {
        id: 'prop-v1',
        grupo_id: 'g-1',
        n_passageiros_propostos: 2,
        estado: 'aberta',
      };

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
          throw new Error('syncNCandidato não deve mutar propostas');
        }
        return {};
      });

      const n = await syncNCandidato('g-1');
      expect(n).toBe(3);
      expect(propostaAntiga.n_passageiros_propostos).toBe(2);
    });

    it('nova proposta após crescimento usa N_actual=3 enquanto v1 mantém N=2', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'pax-owner' } },
      });

      const inserts = [];
      supabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((rows) => {
          inserts.push(rows[0]);
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: `prop-v${inserts.length}`, ...rows[0], estado: 'aberta' },
                error: null,
              }),
            }),
          };
        }),
      });

      await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        grupo_id: 'g-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 80000,
        n_passageiros_propostos: 2,
      });

      await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        grupo_id: 'g-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 120000,
        n_passageiros_propostos: 3,
      });

      expect(inserts).toHaveLength(2);
      expect(inserts[0].n_passageiros_propostos).toBe(2);
      expect(inserts[1].n_passageiros_propostos).toBe(3);
      expect(inserts[0].valor_mensal_ask_kz).toBe(80000);
      expect(inserts[1].valor_mensal_ask_kz).toBe(120000);
    });

    it('listPropostasByProcura devolve M propostas coexistentes', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                { id: 'p1', n_passageiros_propostos: 2, estado: 'aberta' },
                { id: 'p2', n_passageiros_propostos: 3, estado: 'aberta' },
              ],
              error: null,
            }),
          }),
        }),
      });

      const list = await listPropostasByProcura('pr-1');
      expect(list).toHaveLength(2);
      expect(list[0].n_passageiros_propostos).toBe(2);
      expect(list[1].n_passageiros_propostos).toBe(3);
    });
  });

  describe('3 — RPC bloqueiam auto-aceite (iniciador ≠ aceitante)', () => {
    it('createAgreementFromProposal propaga erro quando criador tenta aceitar', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Só a contraparte pode aceitar ou rejeitar esta proposta.',
        },
      });

      await expect(createAgreementFromProposal('prop-self')).rejects.toThrow(/só a contraparte/i);
    });

    it('rejectProposta propaga erro quando criador tenta rejeitar a própria proposta', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Só a contraparte pode aceitar ou rejeitar esta proposta.',
        },
      });

      await expect(rejectProposta('prop-self')).rejects.toThrow(/só a contraparte/i);
    });

    it('accept_proposal SQL bloqueia created_by = auth.uid()', () => {
      const sql = readFileSync(
        join(MIGRATIONS, '20260905094819_marketplace_t32_accept_reject_contraparte.sql'),
        'utf8',
      );
      expect(sql).toMatch(/IF v_uid = v_prop\.created_by/);
      expect(sql).toMatch(/Só a contraparte pode aceitar ou rejeitar esta proposta/);
    });

    it('P0 remove UPDATE client em propostas (snapshots só via RPC)', () => {
      const sql = readFileSync(
        join(MIGRATIONS, '20260905111441_marketplace_p0_hardening_leave_rls.sql'),
        'utf8',
      );
      expect(sql).toMatch(/DROP POLICY IF EXISTS propostas_update_envolvidos/);
    });
  });

  describe('4 — Preços/valores vêm da proposta, nunca defaults da plataforma', () => {
    it('resolveAgreementPricing usa valor_ask_kz da proposta (TOTAL_ACORDO)', () => {
      const pricing = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 77000,
        n_passageiros: 3,
      });
      expect(pricing.valor_mensal_total_kz).toBe(77000);
      expect(pricing.quotas.reduce((a, b) => a + b, 0)).toBe(77000);
    });

    it('buildPropostaReview deriva preço do snapshot da proposta, não da oferta', () => {
      const review = buildPropostaReview(
        {
          grupo_id: 'g-1',
          modo_preco: 'POR_PASSAGEIRO',
          valor_mensal_ask_kz: 43000,
          n_passageiros_propostos: 2,
        },
        [
          { passenger_id: 'p1', perfis: { nome_completo: 'Ana' } },
          { passenger_id: 'p2', perfis: { nome_completo: 'Bruno' } },
        ],
      );
      expect(review.pricing.valor_mensal_total_kz).toBe(86000);
      expect(review.pricing.valor_mensal_por_passageiro_kz).toBe(43000);
    });

    it('accept_proposal SQL usa v_prop.valor_mensal_ask_kz (não oferta default)', () => {
      const sql = readFileSync(
        join(MIGRATIONS, '20260906092029_audit_gaps_accept_proposal_member_ids.sql'),
        'utf8',
      );
      expect(sql).toMatch(/v_base := v_prop\.valor_mensal_ask_kz/);
      expect(sql).toMatch(/v_total := v_prop\.valor_mensal_ask_kz/);
      expect(sql).not.toMatch(/v_oferta\.valor_mensal_ask_kz/);
    });
  });

  describe('5 — UI: inbox/CTAs só com auth (userId)', () => {
    it('filterPropostasParaInbox devolve [] sem userId', () => {
      expect(
        filterPropostasParaInbox(
          [{ id: 'p1', estado: 'aberta', created_by: 'other' }],
          '',
        ),
      ).toEqual([]);
    });

    it('filterPropostasEnviadas devolve [] sem userId', () => {
      expect(
        filterPropostasEnviadas(
          [{ id: 'p1', estado: 'aberta', created_by: 'me' }],
          '',
        ),
      ).toEqual([]);
    });

    it('inbox exclui propostas criadas pelo próprio utilizador', () => {
      const list = filterPropostasParaInbox(
        [
          { id: 'p1', estado: 'aberta', created_by: 'driver-1' },
          { id: 'p2', estado: 'aberta', created_by: 'pax-1' },
        ],
        'pax-1',
      );
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('p1');
    });
  });

  describe('6 — Fluxos A/B (passageiro↔motorista)', () => {
    it('Sentido A: passageiro cria proposta (created_by = owner procura)', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'pax-1' } },
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'prop-a',
              created_by: 'pax-1',
              estado: 'aberta',
              n_passageiros_propostos: 1,
            },
            error: null,
          }),
        }),
      });
      supabase.from.mockReturnValue({ insert: mockInsert });

      await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 35000,
        n_passageiros_propostos: 1,
      });

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ created_by: 'pax-1' }),
      ]);
      expect(resolvePropostaInbox({
        createdBy: 'pax-1',
        driverId: 'driver-1',
        ownerId: 'pax-1',
      })).toBe('motorista');
    });

    it('Sentido B: motorista cria proposta (created_by = driver)', async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'driver-1' } },
      });
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'prop-b',
              created_by: 'driver-1',
              estado: 'aberta',
              n_passageiros_propostos: 1,
            },
            error: null,
          }),
        }),
      });
      supabase.from.mockReturnValue({ insert: mockInsert });

      await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_ask_kz: 35000,
        n_passageiros_propostos: 1,
      });

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ created_by: 'driver-1' }),
      ]);
      expect(resolvePropostaInbox({
        createdBy: 'driver-1',
        driverId: 'driver-1',
        ownerId: 'pax-1',
      })).toBe('passageiro');
    });
  });
});
