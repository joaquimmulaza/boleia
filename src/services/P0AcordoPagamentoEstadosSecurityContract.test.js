/**
 * P0 acordo × pagamento — contrato REVOKE/GRANT (B1–B2), estilo SecDefaultPrivilegesContract.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const P0_MIGRATION = '20261009180000_p0_acordo_pagamento_estados.sql';
const PG_PROOF = join(ROOT, '../../supabase/tests/p0_acordo_pagamento_estados_pg_proof.sql');

/** Helpers internos: sem EXECUTE para anon/authenticated. */
export const P0_INTERNAL_HELPER_FUNCTIONS = [
  '_valor_pago_efectivo_kz(public.pagamentos_acordo)',
  '_anular_pagamento_sem_divida(uuid, text)',
  '_expirar_lugar_reservado_sem_divida(uuid, text)',
  'ajustar_obrigacao_pagamento_mes(uuid, date, boolean)',
  '_maybe_fechar_acordo_sem_lugares_vivos(uuid)',
  '_p0_finalize_lugares_rescisao_imediata(uuid, date)',
  '_p0_lazy_apply_due_global_caller()',
  '_p0_acordo_in_lazy_apply_due_scope(uuid)',
  '_p0_assert_lazy_apply_due_scope(uuid)',
  'build_ui_obrigacao_snapshot(uuid)',
  'trg_acordos_passageiros_create_pagamento()',
];

/** Lazy apply_due_*: authenticated sim; anon não; scope validado em runtime. */
export const P0_LAZY_APPLY_DUE_FUNCTIONS = [
  'apply_due_reserva_expiry(uuid)',
  'apply_due_agreement_terminations(uuid)',
  'apply_due_agreement_non_renewals(uuid)',
];

/** @param {string} filename */
function readMigration(filename) {
  const path = join(MIGRATIONS, filename);
  if (!existsSync(path)) {
    throw new Error(`Migração em falta: ${filename}`);
  }
  return readFileSync(path, 'utf8');
}

/**
 * @param {string} sql
 * @param {string} fnSpec e.g. `_foo(uuid, text)`
 */
function escapeRegex(fnSpec) {
  return fnSpec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {string} sql
 * @param {string} fnSpec
 */
function expectsRevokeAllFromPublic(sql, fnSpec) {
  const re = new RegExp(
    `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${escapeRegex(fnSpec)}\\s+FROM\\s+PUBLIC`,
    'i',
  );
  return re.test(sql);
}

/**
 * @param {string} sql
 * @param {string} fnSpec
 */
function expectsRevokeExecuteFromAnonAuthenticated(sql, fnSpec) {
  const re = new RegExp(
    `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapeRegex(fnSpec)}\\s+FROM\\s+anon,\\s*authenticated`,
    'i',
  );
  return re.test(sql);
}

/**
 * @param {string} sql
 * @param {string} fnSpec
 */
function expectsGrantExecuteToServiceRole(sql, fnSpec) {
  const re = new RegExp(
    `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapeRegex(fnSpec)}\\s+TO\\s+service_role`,
    'i',
  );
  return re.test(sql);
}

describe('P0 pagamento estados — contrato segurança (migração 180000)', () => {
  /** @type {string} */
  let sql;

  beforeAll(() => {
    sql = readMigration(P0_MIGRATION);
  });

  it('migração 20261009180000 existe', () => {
    expect(existsSync(join(MIGRATIONS, P0_MIGRATION))).toBe(true);
  });

  it.each(P0_INTERNAL_HELPER_FUNCTIONS)(
    'helper %s: REVOKE ALL FROM PUBLIC + REVOKE EXECUTE FROM anon, authenticated',
    (fnSpec) => {
      expect(expectsRevokeAllFromPublic(sql, fnSpec), `REVOKE ALL PUBLIC → ${fnSpec}`).toBe(true);
      expect(
        expectsRevokeExecuteFromAnonAuthenticated(sql, fnSpec),
        `REVOKE EXECUTE anon/authenticated → ${fnSpec}`,
      ).toBe(true);
    },
  );

  it.each(P0_INTERNAL_HELPER_FUNCTIONS.filter((f) => f !== 'trg_acordos_passageiros_create_pagamento()'))(
    'helper %s: GRANT EXECUTE TO service_role',
    (fnSpec) => {
      expect(expectsGrantExecuteToServiceRole(sql, fnSpec), `GRANT service_role → ${fnSpec}`).toBe(
        true,
      );
    },
  );

  it.each(P0_LAZY_APPLY_DUE_FUNCTIONS)(
    'lazy %s: REVOKE ALL PUBLIC, GRANT authenticated, REVOKE anon (sem REVOKE authenticated)',
    (fnSpec) => {
      expect(expectsRevokeAllFromPublic(sql, fnSpec)).toBe(true);
      expect(
        new RegExp(
          `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapeRegex(fnSpec)}\\s+TO\\s+authenticated`,
          'i',
        ).test(sql),
      ).toBe(true);
      expect(
        new RegExp(
          `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapeRegex(fnSpec)}\\s+FROM\\s+anon`,
          'i',
        ).test(sql),
      ).toBe(true);
      expect(
        new RegExp(
          `REVOKE\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${escapeRegex(fnSpec)}\\s+FROM\\s+authenticated`,
          'i',
        ).test(sql),
      ).toBe(false);
    },
  );

  it('_p0_assert_lazy_apply_due_scope referenciado nas três apply_due_*', () => {
    const calls = (sql.match(/PERFORM public\._p0_assert_lazy_apply_due_scope\(p_acordo_id\)/g) || [])
      .length;
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it('B2: NULL autenticado filtra via _p0_acordo_in_lazy_apply_due_scope (não 42501 global)', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\._p0_acordo_in_lazy_apply_due_scope/);
    expect(sql).toMatch(/_p0_acordo_in_lazy_apply_due_scope\(ap\.acordo_id\)/);
    expect(sql).toMatch(/IF p_acordo_id IS NULL THEN[\s\S]*IF v_uid IS NULL THEN[\s\S]*RETURN;/);
  });

  it('prova PG cobre helpers e apply_due mass/foreign (42501)', () => {
    const proof = readFileSync(PG_PROOF, 'utf8');
    expect(proof).toMatch(/FAIL-on-old: authenticated EXECUTE build_ui_obrigacao_snapshot/);
    for (const fn of [
      '_valor_pago_efectivo_kz',
      '_anular_pagamento_sem_divida',
      '_expirar_lugar_reservado_sem_divida',
      'ajustar_obrigacao_pagamento_mes',
      '_maybe_fechar_acordo_sem_lugares_vivos',
      '_p0_finalize_lugares_rescisao_imediata',
      '_p0_assert_lazy_apply_due_scope',
      'build_ui_obrigacao_snapshot',
    ]) {
      expect(proof, `runtime negado → ${fn}`).toMatch(new RegExp(fn));
    }
    expect(proof).toMatch(/FAIL B2: acordo B bloqueado/);
    expect(proof).toMatch(/apply_due_reserva_expiry\(NULL\)/);
    expect(proof).toMatch(/service_role NULL/);
    expect(proof).toMatch(/apply_due_reserva_expiry\(foreign\)/);
    expect(proof).toMatch(/apply_due_agreement_terminations\(foreign\)/);
    expect(proof).toMatch(/apply_due_agreement_non_renewals\(foreign\)/);
    expect(proof).toMatch(/apply_due_reserva_expiry\(v_acordo\)/);
  });
});
