/**
 * PACOTE ENG #5 — pagamento escrow, storage, gate contactos, admin, take-rate.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  submitPaymentProof,
  adminValidatePayment,
  getAcordoContactos,
} from './PaymentService.js';
import {
  computePayoutLiquidoKz,
  allowsContactReveal,
  canTransitionPayment,
  TAKE_RATE_PCT,
} from '../utils/paymentStatus.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: { from: vi.fn() },
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

describe('PACOTE ENG #5 — pagamento escrow + gate contactos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1 — Estados de pagamento', () => {
    it('SQL define CHECK com os cinco estados', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/pendente_pagamento/);
      expect(sql).toMatch(/comprovativo_enviado/);
      expect(sql).toMatch(/em_custodia/);
      expect(sql).toMatch(/liquidado/);
      expect(sql).toMatch(/reembolsado/);
    });

    it('canTransitionPayment bloqueia saltos inválidos', () => {
      expect(canTransitionPayment('pendente_pagamento', 'em_custodia')).toBe(false);
      expect(canTransitionPayment('comprovativo_enviado', 'em_custodia')).toBe(true);
    });
  });

  describe('2 — Storage privado com RLS', () => {
    it('migração cria bucket comprovativos-pagamento não público', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/comprovativos-pagamento/);
      expect(sql).toMatch(/comprovativos-pagamento[\s\S]*false/);
      expect(sql).toMatch(/storage\.objects/i);
    });
  });

  describe('3 — Contactos bloqueados até em_custodia', () => {
    it('allowsContactReveal exige em_custodia ou liquidado', () => {
      expect(allowsContactReveal('comprovativo_enviado')).toBe(false);
      expect(allowsContactReveal('em_custodia')).toBe(true);
    });

    it('getAcordoContactos delega ao RPC (gate servidor)', async () => {
      supabase.rpc.mockResolvedValue({
        data: { bloqueado: true, motorista: null, passageiros: [] },
        error: null,
      });
      const result = await getAcordoContactos('acordo-gate');
      expect(supabase.rpc).toHaveBeenCalledWith('get_acordo_contactos', {
        p_acordo_id: 'acordo-gate',
      });
      expect(result.bloqueado).toBe(true);
    });

    it('SQL get_acordo_contactos só expõe telefone após em_custodia', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/get_acordo_contactos/);
      expect(sql).toMatch(/em_custodia|liquidado/i);
    });
  });

  describe('4 — IBAN motorista no perfil', () => {
    it('migração adiciona iban e iban_titular a perfis', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/iban_titular/);
      expect(sql).toMatch(/ALTER TABLE public\.perfis/);
    });
  });

  describe('5 — Admin valida/rejeita comprovativo', () => {
    it('submitPaymentProof chama RPC dedicada', async () => {
      supabase.rpc.mockResolvedValue({ data: 'pag-x', error: null });
      await submitPaymentProof('pag-x', 'pax/pag-x/f.pdf');
      expect(supabase.rpc).toHaveBeenCalledWith(
        'submit_payment_proof',
        expect.objectContaining({ p_pagamento_id: 'pag-x' }),
      );
    });

    it('adminValidatePayment aprova e rejeita via RPC', async () => {
      supabase.rpc.mockResolvedValue({ data: 'pag-x', error: null });
      await adminValidatePayment('pag-x', true);
      await adminValidatePayment('pag-x', false, 'Inválido');
      expect(supabase.rpc).toHaveBeenCalledWith(
        'admin_validate_payment',
        expect.objectContaining({ p_aprovar: true }),
      );
      expect(supabase.rpc).toHaveBeenCalledWith(
        'admin_validate_payment',
        expect.objectContaining({ p_aprovar: false, p_motivo: 'Inválido' }),
      );
    });

    it('SQL admin_validate_payment exige is_admin', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/admin_validate_payment/);
      expect(sql).toMatch(/is_admin/);
    });
  });

  describe('6 — Valores do acordo (nunca defaults plataforma)', () => {
    it('trigger pagamento usa quota_mensal_kz da linha acordos_passageiros', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/NEW\.quota_mensal_kz/);
      expect(sql).not.toMatch(/DEFAULT\s+\d{4,}/);
    });
  });

  describe('7 — Take-rate ~10% no payout líquido', () => {
    it('TAKE_RATE_PCT documentado é 0.10', () => {
      expect(TAKE_RATE_PCT).toBe(0.1);
    });

    it('computePayoutLiquidoKz aplica 10% sobre quota do acordo', () => {
      expect(computePayoutLiquidoKz(50000)).toBe(45000);
    });

    it('SQL compute_payout_liquido_kz espelha take-rate 0.10', () => {
      const sql = readMigration('20260907010000_pacote_eng5_pagamentos_escrow.sql');
      expect(sql).toMatch(/compute_payout_liquido_kz/);
      expect(sql).toMatch(/0\.10/);
    });
  });
});
