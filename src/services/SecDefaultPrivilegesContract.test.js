/**
 * fix(sec): default privileges + perfis INSERT/DELETE + triggers — contrato SQL
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const SEC_MIGRATION = '20261009160000_sec_default_privileges.sql';
const SEC_MIGRATION_STAMP = '20261009160000';

/** Rotas públicas / sem sessão — nenhum supabase.rpc() no código (rg 2026-10-09). */
export const LOGGED_OUT_CLIENT_RPC_NAMES = [];

/**
 * Allow-list documentada na migração (bloco anon_rpc_allowlist).
 * @param {string} sql
 * @returns {string[]}
 */
function parseAnonRpcAllowlistFromMigration(sql) {
  const block = sql.match(/anon_rpc_allowlist:\s*\(([^)]*)\)/i)?.[1] ?? '';
  const trimmed = block.trim();
  if (!trimmed || trimmed.toLowerCase() === 'vazio') {
    return [];
  }
  return trimmed
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);
}

/** @param {string} filename */
function readMigration(filename) {
  const path = join(MIGRATIONS, filename);
  if (!existsSync(path)) {
    throw new Error(`Migração em falta: ${filename}`);
  }
  return readFileSync(path, 'utf8');
}

/**
 * Funções CREATE OR REPLACE / CREATE FUNCTION (não trigger) num ficheiro SQL.
 * @param {string} sql
 * @returns {string[]}
 */
function listCreatedNonTriggerFunctions(sql) {
  const names = [];
  const re =
    /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z_][a-z0-9_]*)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const start = m.index;
    const chunk = sql.slice(start, start + 800);
    if (/RETURNS\s+trigger/i.test(chunk)) continue;
    names.push(m[1]);
  }
  return [...new Set(names)];
}

/**
 * @param {string} sql
 * @param {string} fnName
 */
function migrationGrantsExecuteToRole(sql, fnName, role) {
  const re = new RegExp(
    `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${fnName}\\([^)]*\\)\\s+TO\\s+${role}`,
    'i',
  );
  return re.test(sql);
}

describe('fix(sec) — default privileges e perfis (contrato migração)', () => {
  it('migração 20261009160000 existe', () => {
    expect(existsSync(join(MIGRATIONS, SEC_MIGRATION))).toBe(true);
  });

  it('não altera ALTER DEFAULT PRIVILEGES em TABLES nem SEQUENCES', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES[\s\S]*?ON TABLES/i);
    expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES[\s\S]*?ON SEQUENCES/i);
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/);
    expect(sql).toMatch(
      /ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon/,
    );
  });

  it('revoga INSERT e DELETE em perfis para authenticated e anon', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(
      /REVOKE INSERT, DELETE ON TABLE public\.perfis FROM authenticated, anon/,
    );
  });

  it('revoga EXECUTE das funções trigger marketplace is_test', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.trg_marketplace_is_test_oferta\(\)/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.trg_marketplace_is_test_procura\(\)/);
  });

  it('storage_comprovativo_pagamento_id usa regex UUID case-insensitive (~*)', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/!~\*\s*'\^\[0-9a-f\]/);
  });

  it('allow-list anon na migração coincide com inventário logged-out do cliente', () => {
    const sql = readMigration(SEC_MIGRATION);
    const allow = parseAnonRpcAllowlistFromMigration(sql);
    expect(allow).toEqual(LOGGED_OUT_CLIENT_RPC_NAMES);
  });

  it('migrações posteriores a 20261009160000: cada CREATE FUNCTION (não trigger) tem GRANT EXECUTE', () => {
    const files = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .filter((f) => f.slice(0, 14) > SEC_MIGRATION_STAMP)
      .sort();

    for (const file of files) {
      const sql = readMigration(file);
      const fns = listCreatedNonTriggerFunctions(sql);
      for (const fn of fns) {
        const hasGrant =
          migrationGrantsExecuteToRole(sql, fn, 'authenticated') ||
          migrationGrantsExecuteToRole(sql, fn, 'anon') ||
          migrationGrantsExecuteToRole(sql, fn, 'service_role');
        expect(hasGrant, `${file} → public.${fn}()`).toBe(true);
      }
    }
  });
});

describe('fix(sec) — cliente não escreve perfis via PostgREST', () => {
  it('rg src/: sem .from(perfis).insert|upsert|delete', () => {
    const srcFiles = readdirSync(join(ROOT, '..'), { recursive: true }).filter(
      (f) => typeof f === 'string' && /\.(js|jsx)$/.test(f),
    );
    const hits = [];
    for (const rel of srcFiles) {
      const content = readFileSync(join(ROOT, '..', rel), 'utf8');
      if (/\.from\(['"]perfis['"]\)\.(insert|upsert|delete)/i.test(content)) {
        hits.push(rel);
      }
    }
    expect(hits).toEqual([]);
  });
});
