/**
 * seat-before-custody — soft-hold `reservado` até `em_custodia`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminValidatePayment } from './PaymentService.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIG = '20260907190000_seat_before_custody_reservado.sql';

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

/** @returns {string} */
function readMig() {
  return readFileSync(join(MIGRATIONS, MIG), 'utf8');
}

describe('seat-before-custody — soft-hold até em_custodia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('S1 — CHECK inclui reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/acordos_passageiros_estado_check/);
    expect(sql).toMatch(/'reservado'/);
    expect(sql).toMatch(/'activo'/);
    expect(sql).toMatch(/'saiu'/);
  });

  it('S2 — oferta_ocupacao conta activo + reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.oferta_ocupacao/);
    expect(sql).toMatch(
      /lower\(ap\.estado\) IN \('activo',\s*'reservado'\)/,
    );
  });

  it('S3 — accept_proposal insere reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.accept_proposal/);
    expect(sql).toMatch(/'reservado'/);
    expect(sql).toMatch(/lugar está reservado|lugar est[aá] reservado/i);
  });

  it('S4 — trigger pagamento dispara em reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/trg_acordos_passageiros_create_pagamento/);
    expect(sql).toMatch(
      /NOT IN \('activo',\s*'reservado'\)/,
    );
  });

  it('S5 — admin_validate_payment promove reservado→activo ao aprovar', () => {
    const sql = readMig();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.admin_validate_payment/);
    expect(sql).toMatch(/lower\(v_ap\.estado\) = 'reservado'/);
    expect(sql).toMatch(/SET estado = 'activo'/);
  });

  it('S6 — leave_passenger aceita reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
    expect(sql).toMatch(
      /NOT IN \('activo',\s*'reservado'\)/,
    );
  });

  it('terminate_agreement liberta activo e reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.terminate_agreement/);
    expect(sql).toMatch(
      /lower\(estado\) IN \('activo',\s*'reservado'\)/,
    );
  });

  it('adminValidatePayment continua a delegar ao RPC', async () => {
    supabase.rpc.mockResolvedValue({ data: 'pag-1', error: null });
    await adminValidatePayment('pag-1', true);
    expect(supabase.rpc).toHaveBeenCalledWith(
      'admin_validate_payment',
      expect.objectContaining({
        p_pagamento_id: 'pag-1',
        p_aprovar: true,
      }),
    );
  });
});
