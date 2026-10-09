/**
 * fix(sec): RLS/column grants tabelas médias + bucket comprovativos — contrato SQL
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

describe('fix(sec) — RLS/grants médios (contrato migração)', () => {
  it('migração existe', () => {
    expect(existsSync(join(MIGRATIONS, SEC_MIGRATION))).toBe(true);
  });

  it('não altera default privileges (PR dedicado; evita quebrar novas tabelas)', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).not.toMatch(/ALTER DEFAULT PRIVILEGES/i);
  });

  it('após revokes de escrita, mantém GRANT SELECT explícito nas tabelas lidas pelo cliente', () => {
    const sql = readMigration(SEC_MIGRATION);
    for (const table of [
      'pagamentos_acordo',
      'propostas',
      'faltas',
      'procuras',
      'lista_espera',
      'grupos',
      'membros_grupo',
      'veiculos',
      'push_subscriptions',
    ]) {
      expect(sql).toMatch(
        new RegExp(`GRANT SELECT ON TABLE public\\.${table} TO authenticated`),
      );
    }
  });

  it('revoga escrita directa em pagamentos_acordo, propostas e faltas', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.pagamentos_acordo/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS pagamentos_update_admin/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.propostas/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS propostas_insert_envolvidos/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.faltas/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS faltas_update_envolvidos/);
  });

  it('procuras: INSERT por colunas sem estado; UPDATE só n_candidato e updated_at', () => {
    const sql = readMigration(SEC_MIGRATION);
    const insertBlock = sql.match(/GRANT INSERT \([\s\S]*?\) ON TABLE public\.procuras/)?.[0] ?? '';
    expect(insertBlock).toMatch(/\bowner_id\b/);
    expect(insertBlock).toMatch(/\bdias_semana\b/);
    expect(insertBlock).not.toMatch(/\bestado\b/);
    expect(insertBlock).not.toMatch(/\bis_test\b/);
    expect(sql).toMatch(/GRANT UPDATE \(n_candidato, updated_at\) ON TABLE public\.procuras/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public\.procuras/);
  });

  it('lista_espera: INSERT só oferta_id, procura_id, grupo_id + trigger estado activa', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/GRANT INSERT \(oferta_id, procura_id, grupo_id\) ON TABLE public\.lista_espera/);
    expect(sql).toMatch(/trg_lista_espera_force_estado_activa/);
  });

  it('membros_grupo: grants de colunas + trigger passageiro + policy pickup', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/GRANT UPDATE \([\s\S]*?estado[\s\S]*?\) ON TABLE public\.membros_grupo/);
    expect(sql).toMatch(/trg_membros_grupo_passenger_update_guard/);
    expect(sql).toMatch(/membros_update_self_pickup/);
  });

  it('veiculos, grupos, push_subscriptions: column grants / revoke UPDATE', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/GRANT UPDATE \(\s*marca_modelo/);
    expect(sql).toMatch(/GRANT UPDATE \(nome, n_maximo\) ON TABLE public\.grupos/);
    expect(sql).toMatch(/GRANT INSERT \(procura_id, nome, n_maximo\) ON TABLE public\.grupos/);
    expect(sql).toMatch(/REVOKE INSERT, UPDATE ON TABLE public\.push_subscriptions/);
    expect(sql).toMatch(/GRANT INSERT \(user_id, subscription\) ON TABLE public\.push_subscriptions/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS "Users can update their own push subscriptions"/);
  });

  it('storage comprovativos: INSERT/UPDATE/SELECT ligados ao pagamento (mesma regra de path)', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/CREATE POLICY comprovativos_update_own ON storage\.objects/);
    expect(sql).toMatch(/comprovativos_insert_own/);
    expect(sql).toMatch(/comprovativos_select_partes_acordo/);
    expect(sql).toMatch(/can_access_comprovativo_storage/);
    expect(sql).toMatch(/storage_comprovativo_pagamento_id\(name\)/);
  });

  it('helpers das policies storage: EXECUTE para authenticated após REVOKE de PUBLIC/anon', () => {
    const sql = readMigration(SEC_MIGRATION);
    const helpers = [
      'public.storage_comprovativo_pagamento_id(text)',
      'public.can_access_comprovativo_storage(text)',
    ];
    for (const fn of helpers) {
      expect(sql).toMatch(new RegExp(`REVOKE EXECUTE ON FUNCTION ${fn.replace(/[()]/g, '\\$&')}`));
      expect(sql).toMatch(
        new RegExp(`GRANT EXECUTE ON FUNCTION ${fn.replace(/[()]/g, '\\$&')} TO authenticated`),
      );
    }
  });
});
