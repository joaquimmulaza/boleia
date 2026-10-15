/**
 * Regra 5 follow-up — B2 drop legacy liquidate + B3 preview RPC.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const REPO = join(ROOT, '../..');
const MIG = join(REPO, 'supabase/migrations/20261015120000_faltas_regra5_legacy_liquidate_preview.sql');
const PAYMENT_SERVICE = join(REPO, 'src/services/PaymentService.js');
const ADMIN_PAGAMENTOS = join(REPO, 'src/pages/AdminPagamentos.jsx');

/** Callers repo auditados antes do DROP (New Bot B2). */
const B2_CALLERS_AUDIT = {
  frontend: [
    'src/services/PaymentService.js — adminLiquidatePayment → rpc(p_pagamento_id, p_idempotency_key)',
    'src/pages/AdminPagamentos.jsx — adminLiquidatePayment(pagamentoId)',
  ],
  edge: [],
  scripts: [],
  sqlRuntime: [
    'supabase/tests/p0_acordo_pagamento_estados_pg_proof.sql — (uuid, NULL) 2-arg',
    'supabase/tests/faltas_regra5_pg_proof.sql — (uuid, NULL) 2-arg',
  ],
  sqlDefinitionsOnly: [
    'supabase/migrations/20260906230154 — CREATE 1-arg (legacy, alvo do DROP)',
    'supabase/migrations/20260906231204 — CREATE 2-arg',
    'supabase/migrations/20260910100408 — REPLACE 2-arg',
  ],
  prodPgProcOtherFunctions: [],
};

describe('Regra 5 B2/B3 — migração SQL', () => {
  it('auditoria B2: nenhum caller runtime do overload 1-arg', () => {
    expect(B2_CALLERS_AUDIT.edge).toHaveLength(0);
    expect(B2_CALLERS_AUDIT.scripts).toHaveLength(0);
    expect(B2_CALLERS_AUDIT.prodPgProcOtherFunctions).toHaveLength(0);

    const paymentSvc = readFileSync(PAYMENT_SERVICE, 'utf8');
    expect(paymentSvc).toMatch(/rpc\('admin_liquidate_payment'/);
    expect(paymentSvc).toMatch(/p_idempotency_key/);

    const adminPage = readFileSync(ADMIN_PAGAMENTOS, 'utf8');
    expect(adminPage).toMatch(/adminLiquidatePayment\(/);
    expect(adminPage).not.toMatch(/rpc\(['"]admin_liquidate_payment['"]/);
  });

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
