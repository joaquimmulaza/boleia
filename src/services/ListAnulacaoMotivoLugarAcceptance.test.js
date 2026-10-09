/**
 * Contrato RPC estreita — motivos de chip por lugar (PR #249).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const FIX_MIGRATION = '20261009191000_list_anulacao_motivo_lugar_acordo.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('list_anulacao_motivo_lugar_acordos — RPC estreita', () => {
  /** @type {string} */
  let sql;

  beforeAll(() => {
    expect(existsSync(join(MIGRATIONS, FIX_MIGRATION))).toBe(true);
    sql = readMigration(FIX_MIGRATION);
  });

  it('migração 20261009191000 existe com anulacao_motivo', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.list_anulacao_motivo_lugar_acordos/);
    expect(sql).toMatch(/anulacao_motivo text/);
  });

  it('REVOKE PUBLIC/anon e GRANT authenticated', () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.list_anulacao_motivo_lugar_acordos\(uuid\[\]\) FROM PUBLIC/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.list_anulacao_motivo_lugar_acordos\(uuid\[\]\) FROM anon/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.list_anulacao_motivo_lugar_acordos\(uuid\[\]\) TO authenticated/);
  });

  it('search_path fixo public, pg_temp e mascaramento pagamento_estado', () => {
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
    expect(sql).toMatch(/WHEN ap\.passenger_id = v_uid THEN pg\.estado/);
    expect(sql).toMatch(/ELSE NULL\s*\n\s*END AS pagamento_estado/s);
    expect(sql).toMatch(/WHEN pg\.estado = 'anulado' THEN pg\.anulacao_motivo/);
  });
});
