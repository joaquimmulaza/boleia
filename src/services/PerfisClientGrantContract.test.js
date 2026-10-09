/**
 * Contrato: cliente só pede colunas SELECT grantadas em `perfis`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERFIL_COLUNAS_GRANT_SELECT, PERFIL_COLUNAS_SELECT } from '../utils/perfisGrants.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, '..');
const MIGRATION = join(
  SRC,
  '../supabase/migrations/20261004073111_perfis_colunas_sensiveis_select.sql',
);

function readMigrationGrantColumns() {
  const sql = readFileSync(MIGRATION, 'utf8');
  const block = sql.match(/GRANT SELECT \([\s\S]*?\) ON TABLE public\.perfis/)?.[0] ?? '';
  const cols = [...block.matchAll(/\b([a-z_]+)\b/g)]
    .map((m) => m[1])
    .filter((c) => !['GRANT', 'SELECT', 'ON', 'TABLE', 'public', 'perfis', 'TO', 'authenticated'].includes(c));
  return cols.sort();
}

describe('perfis — contrato grants vs cliente', () => {
  it('PERFIL_COLUNAS_SELECT alinha com migração 20261004073111', () => {
    const fromMigration = readMigrationGrantColumns();
    const fromClient = [...PERFIL_COLUNAS_GRANT_SELECT].sort();
    expect(fromClient).toEqual(fromMigration);
    expect(PERFIL_COLUNAS_SELECT.split(',').map((s) => s.trim()).sort()).toEqual(fromMigration);
  });

  it('AuthContext importa PERFIL_COLUNAS_SELECT (select grantado completo)', () => {
    const authCtx = readFileSync(join(SRC, 'contexts/AuthContext.jsx'), 'utf8');
    expect(authCtx).toMatch(/PERFIL_COLUNAS_SELECT/);
    expect(authCtx).not.toMatch(/PERFIL_COLUNAS_SELECT_SESSAO/);
  });

  it('src: .from(perfis).select só usa PERFIL_COLUNAS_SELECT ou constante derivada', () => {
    const files = readdirSync(SRC, { recursive: true }).filter(
      (f) => typeof f === 'string' && /\.(js|jsx)$/.test(f) && !f.includes('.test.'),
    );
    const violations = [];
    for (const rel of files) {
      const path = join(SRC, rel);
      const content = readFileSync(path, 'utf8');
      const blocks = content.match(/\.from\(['"]perfis['"]\)[\s\S]*?(?=;\s*\n|\n\s*\}\s*[,;]?|\n\s*return)/g) ?? [];
      if (blocks.length === 0) continue;
      for (const block of blocks) {
        if (/\.select\(\s*['"]\*['"]/.test(block)) {
          violations.push(`${rel}: select('*') em perfis`);
        }
        if (/\.select\(\s*\)/.test(block) && !block.includes('PERFIL_COLUNAS_SELECT')) {
          violations.push(`${rel}: select() sem PERFIL_COLUNAS_SELECT`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
