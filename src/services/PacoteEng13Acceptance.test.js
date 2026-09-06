/**
 * PACOTE ENG #13 — liquidação período + take-rate ~10% + repasse motorista.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adminLiquidatePayment,
  adminLiquidatePeriod,
  listRepassesMotorista,
} from './PaymentService.js';
import {
  TAKE_RATE_PCT,
  computePayoutLiquidoKz,
  computePlatformFeeKz,
  computeRepasseLiquidoKz,
  allowsAssiduidadeFaltas,
} from '../utils/paymentStatus.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'admin-1' } },
      }),
    },
  },
}));

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('PACOTE ENG #13 — liquidação período + repasse motorista', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1 — Liquidação só GMV on-platform (em_custodia)', () => {
    it('SQL admin_liquidate_period só processa em_custodia', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/admin_liquidate_period/);
      expect(sql).toMatch(/em_custodia/);
      expect(sql).not.toMatch(/pendente_pagamento.*liquidado/s);
    });

    it('SQL admin_liquidate_payment rejeita estados fora de custódia', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/admin_liquidate_payment/);
      expect(sql).toMatch(/em_custodia/);
    });
  });

  describe('2 — Take-rate ~10% e repasse líquido', () => {
    it('TAKE_RATE_PCT é 0.10', () => {
      expect(TAKE_RATE_PCT).toBe(0.1);
    });

    it('computePlatformFeeKz retém ~10% do GMV', () => {
      expect(computePlatformFeeKz(50000)).toBe(5000);
      expect(computePayoutLiquidoKz(50000)).toBe(45000);
    });

    it('SQL repasses_motorista regista valor_plataforma_kz e valor_repasse_liquido_kz', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/repasses_motorista/);
      expect(sql).toMatch(/valor_plataforma_kz/);
      expect(sql).toMatch(/valor_repasse_liquido_kz/);
      expect(sql).toMatch(/iban_destino/);
    });

    it('adminLiquidatePeriod delega ao RPC com mes_referencia', async () => {
      supabase.rpc.mockResolvedValue({
        data: { repasses: [{ id: 'rep-1' }], pagamentos_liquidados: 2 },
        error: null,
      });

      await adminLiquidatePeriod('2026-09-01', null, 'key-1');

      expect(supabase.rpc).toHaveBeenCalledWith('admin_liquidate_period', {
        p_mes_referencia: '2026-09-01',
        p_driver_id: null,
        p_idempotency_key: 'key-1',
      });
    });
  });

  describe('3 — faltaDesconto gated (#11)', () => {
    it('allowsAssiduidadeFaltas bloqueia sem custódia', () => {
      expect(allowsAssiduidadeFaltas('pendente_pagamento')).toBe(false);
      expect(allowsAssiduidadeFaltas('em_custodia')).toBe(true);
    });

    it('SQL liquidação subtrai descontos de faltas do payout', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/desconto_kz/);
      expect(sql).toMatch(/pagamento_em_custodia_para_falta|valor_payout_liquido_kz/);
    });

    it('computeRepasseLiquidoKz aplica descontos após take-rate', () => {
      const payout = computePayoutLiquidoKz(43000);
      expect(computeRepasseLiquidoKz(payout, 1364)).toBe(payout - 1364);
    });
  });

  describe('4 — IBAN motorista obrigatório para repasse', () => {
    it('SQL admin_liquidate_period exige IBAN no perfil do motorista', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/iban/);
      expect(sql).toMatch(/RAISE EXCEPTION.*IBAN/i);
    });
  });

  describe('5 — Admin, idempotência, valores do acordo', () => {
    it('SQL RPCs exigem is_platform_admin', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/is_platform_admin/);
    });

    it('SQL admin_liquidate_payment suporta p_idempotency_key', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/p_idempotency_key/);
      expect(sql).toMatch(/rpc_idempotency/);
    });

    it('adminLiquidatePayment passa idempotency key opcional', async () => {
      supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
      await adminLiquidatePayment('pag-1', 'idem-1');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_liquidate_payment', {
        p_pagamento_id: 'pag-1',
        p_idempotency_key: 'idem-1',
      });
    });

    it('SQL usa valor_kz e valor_payout_liquido_kz da linha pagamento (sem defaults plataforma)', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/valor_kz/);
      expect(sql).toMatch(/valor_payout_liquido_kz/);
      expect(sql).not.toMatch(/DEFAULT\s+\d{5,}/);
    });

    it('listRepassesMotorista consulta repasses_motorista', async () => {
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'rep-1', valor_repasse_liquido_kz: 90000 }],
            error: null,
          }),
        }),
      });

      const rows = await listRepassesMotorista();
      expect(rows).toHaveLength(1);
      expect(supabase.from).toHaveBeenCalledWith('repasses_motorista');
    });
  });

  describe('6 — Repasse regista pagamentos liquidados', () => {
    it('SQL pagamentos_acordo tem repasse_id FK', () => {
      const sql = readMigration('20260907030000_pacote_eng13_liquidacao_periodo_repasse.sql');
      expect(sql).toMatch(/repasse_id/);
      expect(sql).toMatch(/REFERENCES public\.repasses_motorista/);
    });
  });
});
