/**
 * Contrato: colunas enviadas em upsert PostgREST ⊆ GRANT UPDATE da tabela.
 * Storage .upload({ upsert: true }) não passa por column grants — fora de âmbito.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const SEC_MIGRATION = '20261009150000_sec_rls_grants_medio.sql';

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
 * @param {string} table
 * @returns {string[]}
 */
function parseUpdateGrantColumns(sql, table) {
  const re = /GRANT UPDATE\s*\(([\s\S]*?)\)\s*ON TABLE public\.(\w+)/gi;
  for (const match of sql.matchAll(re)) {
    if (match[2] === table) {
      return match[1]
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
    }
  }
  return [];
}

/** Upserts `.from(...).upsert` no cliente (rg upsert src/) */
const CLIENT_TABLE_UPSERTS = [
  {
    table: 'veiculos',
    source: 'src/pages/VehicleSetup.jsx',
    columns: [
      'id_motorista',
      'marca_modelo',
      'matricula',
      'capacidade_total',
      'vagas_passageiros',
    ],
  },
];

describe('fix(sec) — upsert cliente vs GRANT UPDATE (contrato)', () => {
  it('migração sec_rls_grants_medio existe', () => {
    expect(existsSync(join(MIGRATIONS, SEC_MIGRATION))).toBe(true);
  });

  it('cada coluna do upsert PostgREST está no GRANT UPDATE da tabela', () => {
    const sql = readMigration(SEC_MIGRATION);
    for (const { table, columns, source } of CLIENT_TABLE_UPSERTS) {
      const granted = new Set(parseUpdateGrantColumns(sql, table));
      const missing = columns.filter((col) => !granted.has(col));
      expect(missing, `${source} → public.${table}`).toEqual([]);
    }
  });

  it('veiculos: RLS UPDATE WITH CHECK fixa id_motorista = auth.uid() (schema base)', () => {
    const baseSchema = readFileSync(
      join(MIGRATIONS, '20260329161035_remote_schema.sql'),
      'utf8',
    );
    expect(baseSchema).toMatch(/create policy "veiculos_update_proprio_motorista"/i);
    expect(baseSchema).toMatch(
      /veiculos_update_proprio_motorista[\s\S]*?with check \(\(auth\.uid\(\) = id_motorista\)\)/i,
    );
  });

  it('membros_grupo INSERT: trigger limita estado inicial activo|pendente', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/trg_membros_grupo_insert_estado_guard/);
    expect(sql).toMatch(/NOT IN \('activo', 'pendente'\)/);
  });

  it('leave_grupo_membro: guard UPDATE não bloqueia RPC SECURITY DEFINER', () => {
    const sql = readMigration(SEC_MIGRATION);
    const leaveRpc = readFileSync(
      join(MIGRATIONS, '20260906004109_rpc_idempotency_wave4_leave_grupo_membro.sql'),
      'utf8',
    );
    expect(leaveRpc).toMatch(/SET estado = 'saiu'/);
    expect(sql).toMatch(/current_user <> 'authenticated'/);
  });
});
