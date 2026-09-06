/**
 * PACOTE ENG #11 — assiduidade/faltaDesconto gate pagamento + liquidação on-platform.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logAbsence } from './AbsenceService.js';
import { adminLiquidatePayment } from './PaymentService.js';
import {
  allowsAssiduidadeFaltas,
  computePayoutLiquidoKz,
  computeRepasseLiquidoKz,
} from '../utils/paymentStatus.js';
import { computeFaltaDesconto } from '../utils/faltaDesconto.js';
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
    },
  },
}));

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('PACOTE ENG #11 — assiduidade + faltaDesconto gate pagamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1 — Sem pagamento em custódia → bloqueio', () => {
    it('allowsAssiduidadeFaltas exige em_custodia (ou liquidado)', () => {
      expect(allowsAssiduidadeFaltas('pendente_pagamento')).toBe(false);
      expect(allowsAssiduidadeFaltas('comprovativo_enviado')).toBe(false);
      expect(allowsAssiduidadeFaltas('em_custodia')).toBe(true);
      expect(allowsAssiduidadeFaltas('liquidado')).toBe(true);
    });

    it('logAbsence delega ao RPC log_falta (gate servidor)', async () => {
      supabase.rpc.mockResolvedValue({
        data: { id: 'f1', desconto_kz: 0 },
        error: null,
      });

      await logAbsence({
        id_acordo: 'acordo-1',
        data_falta: '2026-09-04',
        tipo: 'Passageiro',
        passenger_id: 'user-1',
      });

      expect(supabase.rpc).toHaveBeenCalledWith(
        'log_falta',
        expect.objectContaining({
          p_id_acordo: 'acordo-1',
          p_tipo: 'Passageiro',
        }),
      );
      expect(supabase.from).not.toHaveBeenCalled();
    });

    it('SQL handle_falta_desconto zera desconto sem pagamento em custódia', () => {
      const sql = readMigration('20260907020000_pacote_eng11_assiduidade_faltadesconto_gate.sql');
      expect(sql).toMatch(/handle_falta_desconto/);
      expect(sql).toMatch(/em_custodia/);
      expect(sql).toMatch(/desconto_kz\s*:=\s*0/);
    });

    it('SQL log_falta rejeita sem pagamento em custódia', () => {
      const sql = readMigration('20260907020000_pacote_eng11_assiduidade_faltadesconto_gate.sql');
      expect(sql).toMatch(/log_falta/);
      expect(sql).toMatch(/em_custodia/);
      expect(sql).toMatch(/RAISE EXCEPTION/);
    });
  });

  describe('2 — Com pagamento → desconto conforme acordo', () => {
    it('computeFaltaDesconto usa quota/dias do acordo (sem defaults plataforma)', () => {
      expect(computeFaltaDesconto(30000, 22)).toBe(1363.64);
    });

    it('SQL handle_falta_desconto mantém fórmula quota/dias_uteis', () => {
      const sql = readMigration('20260907020000_pacote_eng11_assiduidade_faltadesconto_gate.sql');
      expect(sql).toMatch(/valor_mensal_por_passageiro_kz/);
      expect(sql).toMatch(/dias_uteis_mes/);
      expect(sql).not.toMatch(/\/\s*4\.0/);
    });
  });

  describe('3 — Liquidação só com eventos on-platform', () => {
    it('adminLiquidatePayment delega ao RPC', async () => {
      supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
      await adminLiquidatePayment('pag-1');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_liquidate_payment', {
        p_pagamento_id: 'pag-1',
      });
    });

    it('computeRepasseLiquidoKz subtrai descontos de faltas do payout', () => {
      const payout = computePayoutLiquidoKz(50000);
      expect(computeRepasseLiquidoKz(payout, 1363.64)).toBe(43636);
      expect(computeRepasseLiquidoKz(payout, 50000)).toBe(0);
    });

    it('SQL admin_liquidate_payment exige em_custodia e desconta faltas', () => {
      const sql = readMigration('20260907020000_pacote_eng11_assiduidade_faltadesconto_gate.sql');
      expect(sql).toMatch(/admin_liquidate_payment/);
      expect(sql).toMatch(/em_custodia/);
      expect(sql).toMatch(/liquidado/);
      expect(sql).toMatch(/faltas/);
      expect(sql).toMatch(/is_platform_admin/);
    });
  });

  describe('4 — Valores do acordo (nunca defaults plataforma)', () => {
    it('SQL liquidação usa valor_payout_liquido_kz da linha pagamento', () => {
      const sql = readMigration('20260907020000_pacote_eng11_assiduidade_faltadesconto_gate.sql');
      expect(sql).toMatch(/valor_payout_liquido_kz/);
      expect(sql).not.toMatch(/DEFAULT\s+\d{4,}/);
    });
  });
});
