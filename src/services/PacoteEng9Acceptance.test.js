/**
 * PACOTE ENG #9 — waitlist quando capacidade < N_proposto.
 * Gate capacidade, promoção sem auto-aceite, estados waitlist, snapshot, ENG#3 intacto.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgreementFromProposal } from './AgreementService.js';
import { createProposta } from './PropostaService.js';
import { enqueueWaitlist, promoteWaitlist } from './WaitlistService.js';
import { evaluateMatch } from '../utils/matchingFilters.js';
import { requiresWaitlist, resolveCapacityN } from '../utils/capacityGate.js';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
      }),
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

describe('PACOTE ENG #9 — waitlist vs capacidade / N_proposto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  describe('1 — Capacidade insuficiente → waitlist (não acordo)', () => {
    it('evaluateMatch classifica waitlist quando N > vagas', () => {
      const outcome = evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 1,
          dias_semana: [1, 2, 3, 4, 5],
        },
        procura: {
          preferred_time: '07:05',
          dias_semana: [1, 2, 3, 4, 5],
        },
        n_candidato: 3,
      });
      expect(outcome).toBe('waitlist');
      expect(requiresWaitlist(3, 1)).toBe(true);
    });

    it('accept_proposal propaga erro de vagas insuficientes (sem SELECT acordo)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Vagas insuficientes para este grupo. Use lista de espera.',
        },
      });

      await expect(createAgreementFromProposal('prop-wl')).rejects.toThrow(
        /Vagas insuficientes.*lista de espera/i,
      );
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('SQL accept_proposal bloqueia quando v_n > v_disponiveis', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/IF v_n > v_disponiveis THEN/);
      expect(sql).toMatch(/Vagas insuficientes para este grupo\. Use lista de espera\./);
    });

    it('enqueueWaitlist insere estado activa (não acordo)', async () => {
      supabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'w-1',
                oferta_id: 'of-1',
                procura_id: 'pr-1',
                estado: 'activa',
              },
              error: null,
            }),
          }),
        }),
      });

      const entry = await enqueueWaitlist({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
      });

      expect(entry.estado).toBe('activa');
      expect(supabase.rpc).not.toHaveBeenCalledWith('accept_proposal', expect.anything());
    });
  });

  describe('2 — Entrada waitlist ≠ acordo automático', () => {
    it('promoteWaitlist não chama accept_proposal', async () => {
      supabase.rpc.mockResolvedValue({ data: 'w-1', error: null });

      await promoteWaitlist('of-1');

      expect(supabase.rpc).toHaveBeenCalledWith('promote_waitlist', {
        p_oferta_id: 'of-1',
      });
      expect(supabase.rpc).not.toHaveBeenCalledWith(
        'accept_proposal',
        expect.anything(),
      );
    });

    it('SQL promote_waitlist não referencia acordos nem accept_proposal', () => {
      const sql = readMigration('20260906230000_pacote_eng9_promote_waitlist_capacity_gate.sql');
      expect(sql).not.toMatch(/accept_proposal/);
      expect(sql).not.toMatch(/INSERT INTO public\.acordos/);
      expect(sql).toMatch(/estado = 'notificada'/);
    });
  });

  describe('3 — Promoção segue fluxo proposta/aceite (sem atalho)', () => {
    it('promote_waitlist SQL exige vagas >= n_candidato antes de notificar', () => {
      const sql = readMigration('20260906230000_pacote_eng9_promote_waitlist_capacity_gate.sql');
      expect(sql).toMatch(/v_n_required := GREATEST\(COALESCE\(v_procura\.n_candidato, 1\), 1\)/);
      expect(sql).toMatch(/IF v_disponiveis < v_n_required THEN/);
      expect(sql).toMatch(/RETURN NULL;/);
    });

    it('promoteWaitlist devolve null quando RPC não promove (capacidade insuficiente)', async () => {
      supabase.rpc.mockResolvedValue({ data: null, error: null });

      const result = await promoteWaitlist('of-cheia');

      expect(result).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalledWith('accept_proposal', expect.anything());
    });

    it('createProposta continua a criar proposta aberta (aceite separado)', async () => {
      supabase.from.mockImplementation((table) => {
        if (table === 'propostas') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'prop-1',
                    estado: 'aberta',
                    n_passageiros_propostos: 3,
                    valor_mensal_ask_kz: 90000,
                    modo_preco: 'TOTAL_ACORDO',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const prop = await createProposta({
        oferta_id: 'of-1',
        procura_id: 'pr-1',
        grupo_id: 'g-1',
        modo_preco: 'TOTAL_ACORDO',
        valor_mensal_ask_kz: 90000,
        n_passageiros_propostos: 3,
      });

      expect(prop.estado).toBe('aberta');
      expect(supabase.rpc).not.toHaveBeenCalledWith('accept_proposal', expect.anything());
    });
  });

  describe('4 — N_actual para capacidade (grupo vivo)', () => {
    it('resolveCapacityN usa membros activos em vez de n_maximo', () => {
      expect(resolveCapacityN({ n_candidato: 4, membrosActivos: 2 })).toBe(2);
      expect(requiresWaitlist(2, 3)).toBe(false);
      expect(requiresWaitlist(4, 3)).toBe(true);
    });

    it('grupo com 2 membros e 3 vagas → direct (N_actual, não n_maximo)', () => {
      const n = resolveCapacityN({ n_candidato: 4, membrosActivos: 2 });
      const outcome = evaluateMatch({
        oferta: {
          departure_time: '07:00',
          flexibilidade_rota: true,
          vagas_disponiveis: 3,
          dias_semana: [1, 2, 3, 4, 5],
        },
        procura: {
          preferred_time: '07:05',
          dias_semana: [1, 2, 3, 4, 5],
        },
        n_candidato: n,
      });
      expect(outcome).toBe('direct');
    });
  });

  describe('5 — Valores snapshot (nunca defaults plataforma)', () => {
    it('resolveAgreementPricing congela ask da proposta', () => {
      const pricing = resolveAgreementPricing({
        modo_preco: 'POR_PASSAGEIRO',
        valor_ask_kz: 42000,
        n_passageiros: 2,
      });
      expect(pricing.valor_mensal_por_passageiro_kz).toBe(42000);
      expect(pricing.valor_mensal_total_kz).toBe(84000);
    });

    it('accept_proposal SQL usa snapshot da proposta', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/v_base := v_prop\.valor_mensal_ask_kz/);
      expect(sql).toMatch(/v_n := v_prop\.n_passageiros_propostos/);
    });
  });

  describe('6 — Não-regressão ENG#3 (aceite atómico intacto)', () => {
    /** @param {object} acordo */
    function mockAcordoSelect(acordo) {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
          }),
        }),
      });
    }

    it('aceite bem-sucedido chama só accept_proposal uma vez', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-eng3', error: null });
      mockAcordoSelect({
        id: 'acordo-eng3',
        n_passageiros_contrato: 2,
        estado: 'activo',
      });

      const result = await createAgreementFromProposal('prop-ok');

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({ p_proposta_id: 'prop-ok' }),
      );
      expect(result.id).toBe('acordo-eng3');
    });

    it('idempotency_key continua obrigatória no cliente online', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-idem', error: null });
      mockAcordoSelect({ id: 'acordo-idem', estado: 'activo' });

      await createAgreementFromProposal('prop-idem', {
        idempotencyKey: '22222222-2222-4222-8222-222222222222',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({
          p_idempotency_key: '22222222-2222-4222-8222-222222222222',
        }),
      );
    });
  });
});
