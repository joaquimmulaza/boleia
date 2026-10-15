/**
 * Regra 5 follow-up — B2 drop legacy liquidate + B3 preview RPC.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIG = join(ROOT, '../../supabase/migrations/20261015120000_faltas_regra5_legacy_liquidate_preview.sql');

describe('Regra 5 B2/B3 — migração SQL', () => {
  it('remove overload admin_liquidate_payment(uuid)', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/DROP FUNCTION IF EXISTS public\.admin_liquidate_payment\(uuid\)/);
  });

  it('expõe get_desconto_faltas_preview com auth passageiro/motorista', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/get_desconto_faltas_preview/);
    expect(sql).toMatch(/_desconto_faltas_pagamento/);
    expect(sql).toMatch(/passenger_id/);
    expect(sql).toMatch(/driver_id/);
    expect(sql).toMatch(/SET search_path TO public, pg_temp/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.get_desconto_faltas_preview\(uuid\) FROM PUBLIC/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_desconto_faltas_preview\(uuid\) TO authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE.*get_desconto_faltas_preview.*TO anon/);
  });
});
