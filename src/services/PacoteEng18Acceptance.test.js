/**
 * PACOTE ENG #18 — TTL reservas (B1), admin piloto (B3), IBAN liquidação (B4).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyDueReservaExpiry } from './AgreementService.js';
import {
  adminLiquidatePayment,
  adminLiquidatePeriod,
} from './PaymentService.js';
import {
  motoristaTemIbanCompleto,
  findMotoristasSemIban,
  RESERVA_TTL_HORAS,
} from '../utils/paymentStatus.js';
import {
  isExpiradoPassageiro,
  labelChipEstadoPassageiro,
} from '../utils/acordoPassageiroStatus.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIG = '20260910120000_pacote_eng18_ttl_reserva_iban_gate.sql';

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

/** @returns {string} */
function readMig() {
  return readFileSync(join(MIGRATIONS, MIG), 'utf8');
}

describe('PACOTE ENG #18 — TTL reservas + admin piloto + IBAN liquidação', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('B1 — TTL reservas', () => {
    it('migração existe com apply_due_reserva_expiry', () => {
      expect(existsSync(join(MIGRATIONS, MIG))).toBe(true);
      const sql = readMig();
      expect(sql).toMatch(/apply_due_reserva_expiry/);
      expect(sql).toMatch(/reservado_expira_em/);
      expect(sql).toMatch(/'expirado'/);
    });

    it('oferta_ocupacao não conta expirado (só activo + reservado)', () => {
      const sql = readMig();
      expect(sql).toMatch(/oferta_ocupacao/);
      expect(sql).toMatch(/lower\(ap\.estado\) IN \('activo',\s*'reservado'\)/);
    });

    it('expiry liberta vaga e promove waitlist best-effort', () => {
      const sql = readMig();
      expect(sql).toMatch(/recount_oferta_vagas/);
      expect(sql).toMatch(/promote_waitlist/);
    });

    it('não expira reserva com comprovativo em validação ou custódia', () => {
      const sql = readMig();
      expect(sql).toMatch(/comprovativo_enviado/);
      expect(sql).toMatch(/em_custodia/);
    });

    it('accept_proposal define reservado_expira_em (TTL 72h)', () => {
      const sql = readMig();
      expect(sql).toMatch(/accept_proposal/);
      expect(sql).toMatch(/reservado_expira_em/);
      expect(sql).toMatch(/72/);
    });

    it('RESERVA_TTL_HORAS expõe 72h para UI', () => {
      expect(RESERVA_TTL_HORAS).toBe(72);
    });

    it('applyDueReservaExpiry delega ao RPC lazy', async () => {
      supabase.rpc.mockResolvedValue({ data: 2, error: null });
      const count = await applyDueReservaExpiry(null);
      expect(supabase.rpc).toHaveBeenCalledWith('apply_due_reserva_expiry', {
        p_acordo_id: null,
      });
      expect(count).toBe(2);
    });

    it('UI distingue estado expirado', () => {
      expect(isExpiradoPassageiro('expirado')).toBe(true);
      expect(labelChipEstadoPassageiro('expirado')).toBe('Expirado');
    });
  });

  describe('B3 — admin piloto (documentação + RPC existente)', () => {
    it('OPS piloto documenta passos admin_validate_payment', () => {
      const ops = readFileSync(
        join(ROOT, '../../.specs/quick/pacote-eng-18-primeiro-acordo/OPS.md'),
        'utf8',
      );
      expect(ops).toMatch(/admin\/pagamentos/i);
      expect(ops).toMatch(/Aprovar/i);
      expect(ops).toMatch(/em_custodia/i);
    });

    it('adminValidatePayment continua a promover reservado→activo (seat-before-custody)', () => {
      const sql = readFileSync(
        join(MIGRATIONS, '20260907190000_seat_before_custody_reservado.sql'),
        'utf8',
      );
      expect(sql).toMatch(/admin_validate_payment/);
      expect(sql).toMatch(/lower\(v_ap\.estado\) = 'reservado'/);
      expect(sql).toMatch(/SET estado = 'activo'/);
    });
  });

  describe('B4 — IBAN motorista obrigatório na liquidação', () => {
    it('SQL admin_liquidate_period exige iban e iban_titular', () => {
      const sql = readMig();
      expect(sql).toMatch(/admin_liquidate_period/);
      expect(sql).toMatch(/iban_titular/);
      expect(sql).toMatch(/RAISE EXCEPTION.*IBAN/i);
    });

    it('SQL admin_liquidate_payment bloqueia sem IBAN completo', () => {
      const sql = readMig();
      expect(sql).toMatch(/admin_liquidate_payment/);
      expect(sql).toMatch(/iban_titular/);
    });

    it('motoristaTemIbanCompleto exige ambos os campos', () => {
      expect(motoristaTemIbanCompleto({ iban: 'AO06…', iban_titular: 'João' })).toBe(true);
      expect(motoristaTemIbanCompleto({ iban: '', iban_titular: 'João' })).toBe(false);
      expect(motoristaTemIbanCompleto({ iban: 'AO06…', iban_titular: '' })).toBe(false);
    });

    it('findMotoristasSemIban lista motoristas em custódia sem IBAN', () => {
      const rows = [
        {
          acordos: {
            driver_id: 'drv-1',
            perfis: { iban: 'AO06', iban_titular: 'Maria' },
          },
        },
        {
          acordos: {
            driver_id: 'drv-2',
            perfis: { iban: '', iban_titular: '' },
          },
        },
      ];
      const sem = findMotoristasSemIban(rows);
      expect(sem).toHaveLength(1);
      expect(sem[0].driverId).toBe('drv-2');
    });

    it('adminLiquidatePeriod delega ao RPC', async () => {
      supabase.rpc.mockResolvedValue({
        data: { pagamentos_liquidados: 1, repasses: [] },
        error: null,
      });
      await adminLiquidatePeriod('2026-09-01');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_liquidate_period', expect.any(Object));
    });

    it('adminLiquidatePayment delega ao RPC', async () => {
      supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
      await adminLiquidatePayment('pag-1');
      expect(supabase.rpc).toHaveBeenCalledWith('admin_liquidate_payment', {
        p_pagamento_id: 'pag-1',
        p_idempotency_key: null,
      });
    });
  });
});
