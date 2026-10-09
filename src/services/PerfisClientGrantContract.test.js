/**
 * Contrato: cliente só pede colunas SELECT grantadas em `perfis`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERFIL_COLUNAS_AUTH_CONTEXT,
  PERFIL_COLUNAS_GRANT_SELECT,
  PERFIL_COLUNAS_SELECT,
} from '../utils/perfisGrants.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, '..');
const MIGRATIONS_DIR = join(SRC, '../supabase/migrations');

const GRANT_KEYWORDS = new Set([
  'GRANT',
  'SELECT',
  'ON',
  'TABLE',
  'public',
  'perfis',
  'TO',
  'authenticated',
  'anon',
  'service_role',
]);

/**
 * Colunas do último GRANT SELECT (…) ON TABLE public.perfis nas migrações (ordem lexicográfica).
 * @returns {string[]}
 */
function readLatestPerfisSelectGrantColumns() {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  /** @type {string[]} */
  let latest = [];
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const matches = [
      ...sql.matchAll(/GRANT SELECT\s*\(\s*([\s\S]*?)\s*\)\s*ON TABLE public\.perfis/gi),
    ];
    for (const match of matches) {
      const cols = [...match[1].matchAll(/\b([a-z_]+)\b/g)]
        .map((m) => m[1])
        .filter((c) => !GRANT_KEYWORDS.has(c));
      if (cols.length > 0) {
        latest = cols;
      }
    }
  }
  return [...latest].sort();
}

describe('perfis — contrato grants vs cliente', () => {
  it('PERFIL_COLUNAS_SELECT alinha com o último GRANT SELECT em migrações perfis', () => {
    const fromMigration = readLatestPerfisSelectGrantColumns();
    expect(fromMigration.length).toBeGreaterThan(0);
    const fromClient = [...PERFIL_COLUNAS_GRANT_SELECT].sort();
    expect(fromClient).toEqual(fromMigration);
    expect(PERFIL_COLUNAS_SELECT.split(',').map((s) => s.trim()).sort()).toEqual(fromMigration);
  });

  it('AuthContext usa PERFIL_COLUNAS_AUTH_CONTEXT ⊆ grants', () => {
    const authCtx = readFileSync(join(SRC, 'contexts/AuthContext.jsx'), 'utf8');
    expect(authCtx).toMatch(/PERFIL_COLUNAS_AUTH_CONTEXT_SELECT/);
    for (const col of PERFIL_COLUNAS_AUTH_CONTEXT) {
      expect(PERFIL_COLUNAS_GRANT_SELECT).toContain(col);
    }
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
