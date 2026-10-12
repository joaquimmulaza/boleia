/**
 * fix(sec): iban_titular SELECT revogado + _create_pagamentos_periodo quota integral.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIG = '20261012173100_iban_titular_revoke_pagamentos_periodo.sql';

/** @param {string} filename */
function readMigration(filename) {
  const path = join(MIGRATIONS, filename);
  if (!existsSync(path)) {
    throw new Error(`Migração em falta: ${filename}`);
  }
  return readFileSync(path, 'utf8');
}

describe('fix(sec) — iban_titular + renovação pagamentos', () => {
  it('migração revoga SELECT iban_titular sem alterar outros GRANT SELECT', () => {
    const sql = readMigration(MIG);
    expect(sql).toMatch(
      /REVOKE SELECT \(iban_titular\) ON TABLE public\.perfis FROM authenticated, anon/,
    );
    const grantBlock = sql.match(/GRANT SELECT \([\s\S]*?\) ON TABLE public\.perfis TO authenticated/)?.[0] ?? '';
    expect(grantBlock).not.toMatch(/\biban_titular\b/);
  });

  it('get_own_perfil_contacto devolve iban_titular', () => {
    const sql = readMigration(MIG);
    expect(sql).toMatch(/get_own_perfil_contacto/);
    expect(sql).toMatch(/'iban_titular', v_iban_titular/);
  });

  it('get_acordo_motorista_dados_bancarios com GRANT authenticated', () => {
    const sql = readMigration(MIG);
    expect(sql).toMatch(/get_acordo_motorista_dados_bancarios/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.get_acordo_motorista_dados_bancarios\(uuid\) TO authenticated/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.get_acordo_motorista_dados_bancarios\(uuid\) FROM anon/);
  });

  it('_create_pagamentos_periodo congela valor_devido_kz = quota', () => {
    const sql = readMigration(MIG);
    expect(sql).toMatch(/valor_quota_original_kz/);
    expect(sql).toMatch(/valor_devido_kz/);
    expect(sql).toMatch(/v_quota,\s*\n\s*v_quota,\s*\n\s*v_quota,/s);
  });
});
