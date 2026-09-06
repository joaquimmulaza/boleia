/**
 * PACOTE ENG #14 — renovação M0→M1 sem recriar acordo.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  renewAgreementPeriod,
  declineAgreementRenewal,
} from './AgreementService.js';
import {
  getPagamentoForPassageiroMes,
  getMesReferenciaAtual,
} from './PaymentService.js';
import {
  labelRenovacaoEstado,
  podeRenovarPeriodo,
  podeRecusarRenovacao,
} from '../utils/periodoRenovacao.js';
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

describe('PACOTE ENG #14 — renovação período M0→M1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1 — Renovação explícita (RPC dedicada, auth)', () => {
    it('SQL define renew_agreement_period com auth.uid()', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/renew_agreement_period/);
      expect(sql).toMatch(/auth\.uid\(\)/);
      expect(sql).toMatch(/Sem permissão para renovar/);
    });

    it('renewAgreementPeriod delega ao RPC com idempotency_key', async () => {
      supabase.rpc.mockResolvedValue({
        data: { acordo_id: 'a1', mes_referencia: '2026-10-01', pagamentos_criados: 2 },
        error: null,
      });
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'a1', estado: 'activo', renovacao_estado: 'renovado' },
          error: null,
        }),
      });
      const result = await renewAgreementPeriod('a1');
      expect(supabase.rpc).toHaveBeenCalledWith(
        'renew_agreement_period',
        expect.objectContaining({
          p_acordo_id: 'a1',
          p_idempotency_key: expect.any(String),
        }),
      );
      expect(result.pagamentos_criados).toBe(2);
    });

    it('declineAgreementRenewal delega ao RPC', async () => {
      supabase.rpc.mockResolvedValue({
        data: { acordo_id: 'a1', renovacao_estado: 'nao_renovar' },
        error: null,
      });
      await declineAgreementRenewal('a1');
      expect(supabase.rpc).toHaveBeenCalledWith(
        'decline_agreement_renewal',
        expect.objectContaining({ p_acordo_id: 'a1' }),
      );
    });
  });

  describe('2 — Herança termos vigentes (adenda em_vigor ou acordo)', () => {
    it('SQL _resolve_termos_vigentes_acordo prioriza adenda em_vigor', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/_resolve_termos_vigentes_acordo/);
      expect(sql).toMatch(/em_vigor/);
      expect(sql).toMatch(/quota_mensal_kz/);
      expect(sql).not.toMatch(/DEFAULT 22/);
    });

    it('SQL _create_pagamentos_periodo usa quota_mensal_kz do passageiro', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/_create_pagamentos_periodo/);
      expect(sql).toMatch(/r\.quota_mensal_kz/);
      expect(sql).toMatch(/compute_payout_liquido_kz\(r\.quota_mensal_kz/);
    });
  });

  describe('3 — Pagamento novo período (escrow path)', () => {
    it('SQL pagamentos UNIQUE por (acordo_passageiro_id, mes_referencia)', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/pagamentos_acordo_passageiro_mes_uniq/);
      expect(sql).toMatch(/acordo_passageiro_id, mes_referencia/);
    });

    it('getPagamentoForPassageiroMes filtra por mes_referencia', async () => {
      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'pag-m1' }, error: null }),
      };
      supabase.from.mockReturnValue(chain);

      await getPagamentoForPassageiroMes('a1', 'p1', '2026-10-01');
      expect(chain.eq).toHaveBeenCalledWith('mes_referencia', '2026-10-01');
    });
  });

  describe('4 — Sem renovação → encerra ciclo sem órfãos', () => {
    it('SQL apply_due_agreement_non_renewals liberta vagas e waitlist', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/apply_due_agreement_non_renewals/);
      expect(sql).toMatch(/recount_oferta_vagas/);
      expect(sql).toMatch(/promote_waitlist/);
      expect(sql).toMatch(/estado = 'saiu'/);
    });

    it('decline_agreement_renewal agenda cancelamento_pendente', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/decline_agreement_renewal/);
      expect(sql).toMatch(/cancelamento_pendente/);
      expect(sql).toMatch(/nao_renovacao/);
    });
  });

  describe('5 — Estados UI renovação', () => {
    it('podeRenovarPeriodo exige acordo activo sem renovação feita', () => {
      expect(podeRenovarPeriodo({ estado: 'activo', renovacao_estado: null })).toBe(true);
      expect(podeRenovarPeriodo({ estado: 'activo', renovacao_estado: 'renovado' })).toBe(false);
      expect(podeRenovarPeriodo({ estado: 'cancelado' })).toBe(false);
      expect(podeRenovarPeriodo({ estado: 'activo', renovacao_estado: 'nao_renovar' })).toBe(false);
    });

    it('podeRecusarRenovacao bloqueia se já renovado', () => {
      expect(podeRecusarRenovacao({ estado: 'activo', renovacao_estado: null })).toBe(true);
      expect(podeRecusarRenovacao({ estado: 'activo', renovacao_estado: 'renovado' })).toBe(false);
    });

    it('labelRenovacaoEstado devolve copy humana', () => {
      expect(labelRenovacaoEstado('renovado')).toMatch(/renovad/i);
      expect(labelRenovacaoEstado('nao_renovar')).toMatch(/termina/i);
    });
  });

  describe('6 — Gate pagamentos mês corrente', () => {
    it('SQL pagamento_em_custodia_para_falta filtra mes_referencia', () => {
      const sql = readMigration('20260907040000_pacote_eng14_renovacao_periodo.sql');
      expect(sql).toMatch(/pagamento_em_custodia_para_falta/);
      expect(sql).toMatch(/pg\.mes_referencia = v_mes/);
    });

    it('getMesReferenciaAtual devolve 1.º dia do mês ISO', () => {
      const mes = getMesReferenciaAtual(new Date('2026-09-15T12:00:00Z'));
      expect(mes).toMatch(/^\d{4}-\d{2}-01$/);
    });
  });
});
