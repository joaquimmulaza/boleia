/**
 * PACOTE ENG #3 — aceite atómico → acordo 1:N (contrato + invariantes SQL).
 * Reutiliza `accept_proposal` SECURITY DEFINER; valida snapshot, capacidade,
 * idempotência, race (mock), sem órfãos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAgreementFromProposal } from './AgreementService.js';
import { acceptProposal } from './PropostaService.js';
import { resolveAgreementPricing } from '../utils/resolveAgreementPricing.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
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

describe('PACOTE ENG #3 — aceite atómico acordo 1:N', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  /**
   * @param {object} acordo
   */
  function mockAcordoSelect(acordo) {
    supabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: acordo, error: null }),
        }),
      }),
    });
  }

  describe('1 — 1 procura → M propostas → 1 aceite → 1 acordo', () => {
    it('aceite chama só accept_proposal (cascata cancela irmãs no servidor)', async () => {
      const acordo = {
        id: 'acordo-1',
        procura_id: 'pr-1',
        n_passageiros_contrato: 2,
        estado: 'activo',
      };
      supabase.rpc.mockResolvedValue({ data: 'acordo-1', error: null });
      mockAcordoSelect(acordo);

      const result = await createAgreementFromProposal('prop-vencedora');

      expect(supabase.rpc).toHaveBeenCalledTimes(1);
      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({ p_proposta_id: 'prop-vencedora' }),
      );
      expect(supabase.from).not.toHaveBeenCalledWith('propostas');
      expect(result.id).toBe('acordo-1');
    });

    it('SQL cancela propostas irmãs abertas da mesma procura após aceite', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(
        /UPDATE public\.propostas\s+SET estado = 'cancelada'[\s\S]*WHERE procura_id = v_prop\.procura_id/,
      );
      expect(sql).toMatch(/AND id <> v_prop\.id/);
      expect(sql).toMatch(/AND estado = 'aberta'/);
    });

    it('SQL fecha procura após aceite bem-sucedido', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/UPDATE public\.procuras\s+SET estado = 'fechada'/);
    });
  });

  describe('2 — Valores do snapshot da proposta (nunca defaults da oferta/plataforma)', () => {
    it('resolveAgreementPricing congela TOTAL_ACORDO do ask da proposta', () => {
      const pricing = resolveAgreementPricing({
        modo_preco: 'TOTAL_ACORDO',
        valor_ask_kz: 77000,
        n_passageiros: 3,
      });
      expect(pricing.valor_mensal_total_kz).toBe(77000);
      expect(pricing.quotas.reduce((a, b) => a + b, 0)).toBe(77000);
    });

    it('acordo devolvido reflecte N_contrato e preços congelados da RPC', async () => {
      const acordo = {
        id: 'acordo-snap',
        n_passageiros_contrato: 3,
        modo_preco: 'POR_PASSAGEIRO',
        valor_mensal_por_passageiro_kz: 43000,
        valor_mensal_total_kz: 129000,
        estado: 'activo',
      };
      supabase.rpc.mockResolvedValue({ data: 'acordo-snap', error: null });
      mockAcordoSelect(acordo);

      const result = await createAgreementFromProposal('prop-snap');

      expect(result.n_passageiros_contrato).toBe(3);
      expect(result.valor_mensal_por_passageiro_kz).toBe(43000);
      expect(result.valor_mensal_total_kz).toBe(129000);
    });

    it('accept_proposal SQL usa v_prop.valor_mensal_ask_kz e v_prop.n_passageiros_propostos', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/v_base := v_prop\.valor_mensal_ask_kz/);
      expect(sql).toMatch(/v_total := v_prop\.valor_mensal_ask_kz/);
      expect(sql).toMatch(/v_n := v_prop\.n_passageiros_propostos/);
      expect(sql).not.toMatch(/v_oferta\.valor_mensal_ask_kz/);
    });
  });

  describe('3 — Capacidade / waitlist / idempotência / race', () => {
    it('propaga erro RPC quando vagas insuficientes (waitlist)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: {
          message: 'Vagas insuficientes para este grupo. Use lista de espera.',
        },
      });

      await expect(createAgreementFromProposal('prop-cheio')).rejects.toThrow(
        /Vagas insuficientes.*lista de espera/i,
      );
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('idempotency_key é sempre enviada ao aceitar online', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-idem', error: null });
      mockAcordoSelect({ id: 'acordo-idem', estado: 'activo' });

      await createAgreementFromProposal('prop-idem', {
        idempotencyKey: '11111111-1111-4111-8111-111111111111',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({
          p_idempotency_key: '11111111-1111-4111-8111-111111111111',
        }),
      );
    });

    it('SQL devolve acordo cacheado quando p_idempotency_key já existe', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/FROM public\.rpc_idempotency\s+WHERE idempotency_key = p_idempotency_key/);
      expect(sql).toMatch(/RETURN v_acordo_id/);
    });

    it('race mock: segundo aceite concorrente falha sem select de acordo (sem parcial)', async () => {
      supabase.rpc
        .mockResolvedValueOnce({ data: 'acordo-a', error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Proposta não está aberta.' },
        });
      mockAcordoSelect({
        id: 'acordo-a',
        n_passageiros_contrato: 2,
        estado: 'activo',
      });

      const [primeiro, segundo] = await Promise.allSettled([
        createAgreementFromProposal('prop-a'),
        createAgreementFromProposal('prop-b'),
      ]);

      expect(primeiro.status).toBe('fulfilled');
      expect(segundo.status).toBe('rejected');
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('FOR UPDATE em proposta e oferta (locks para concorrência)', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/FROM public\.propostas WHERE id = p_proposta_id FOR UPDATE/);
      expect(sql).toMatch(/FROM public\.ofertas_capacidade WHERE id = v_prop\.oferta_id FOR UPDATE/);
      expect(sql).toMatch(/FROM public\.procuras WHERE id = v_prop\.procura_id FOR UPDATE/);
    });
  });

  describe('4 — Sem órfãos (guards procura/acordo; grupo fallback)', () => {
    it('propaga erro quando procura já fechada', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Procura já fechada.' },
      });

      await expect(createAgreementFromProposal('prop-tarde')).rejects.toThrow(/procura já fechada/i);
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('propaga erro quando já existe acordo activo para a procura', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Já existe um acordo activo para esta procura.' },
      });

      await expect(createAgreementFromProposal('prop-duplicada')).rejects.toThrow(
        /acordo activo para esta procura/i,
      );
    });

    it('SQL bloqueia aceite se procura fechada ou acordo activo existente', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/IF lower\(v_procura\.estado\) = 'fechada'/);
      expect(sql).toMatch(/Já existe um acordo activo para esta procura/);
    });

    it('grupo N_actual = N_proposto: fallback auto-select quando p_member_ids vazio', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/IF cardinality\(v_ids\) = 0 THEN/);
      expect(sql).toMatch(/array_agg\(passenger_id ORDER BY ordem_insercao ASC/);
    });

    it('grupo N_actual > N_proposto: exige picker explícito (sem auto-select)', () => {
      const sql = readMigration('20260906220000_pacote_eng3_accept_proposal_atomic.sql');
      expect(sql).toMatch(/IF v_n_activos > v_n THEN/);
      expect(sql).toMatch(/Escolhe exactamente % passageiro/);
    });

    it('acceptProposal encaminha memberIds para RPC (composição explícita)', async () => {
      supabase.rpc.mockResolvedValue({ data: 'acordo-gr', error: null });
      mockAcordoSelect({
        id: 'acordo-gr',
        n_passageiros_contrato: 2,
        estado: 'activo',
      });

      await acceptProposal('prop-gr', ['pax-a', 'pax-b']);

      expect(supabase.rpc).toHaveBeenCalledWith(
        'accept_proposal',
        expect.objectContaining({
          p_proposta_id: 'prop-gr',
          p_member_ids: ['pax-a', 'pax-b'],
        }),
      );
    });

    it('falha RPC não selecciona acordo (sem estado parcial no cliente)', async () => {
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Capacidade inconsistente com proposta' },
      });

      await expect(
        createAgreementFromProposal('prop-bad', { memberIds: ['p1', 'p2', 'p3'] }),
      ).rejects.toThrow(/capacidade inconsistente/i);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });
});
