/**
 * fix(sec): perfis/notificacoes column grants + revoke RPCs internas — contrato SQL
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const SEC_MIGRATION = '20261009033000_sec_perfis_notificacoes_grants.sql';

/** @param {string} filename */
function readMigration(filename) {
  const path = join(MIGRATIONS, filename);
  if (!existsSync(path)) {
    throw new Error(`Migração em falta: ${filename} (aplicar fix sec perfis)`);
  }
  return readFileSync(path, 'utf8');
}

const PERFIS_COLUNAS_CLIENTE = [
  'nome_completo',
  'telefone',
  'iban',
  'iban_titular',
  'onboarding_completed',
  'perfil_completo',
  'tipo_perfil',
];

const PERFIS_PROIBIDAS = ['is_admin', 'is_test'];

const FUNCOES_INTERNAS = [
  '_liquidate_pagamento_row(public.pagamentos_acordo, uuid)',
  '_create_pagamentos_periodo(uuid, date, uuid)',
  '_refresh_repasse_motorista(uuid, date, uuid)',
  'notify_domain_event(uuid, text, text, jsonb, uuid)',
];

describe('fix(sec) — perfis/notificacoes grants (contrato migração)', () => {
  it('migração existe e revoga UPDATE amplo em perfis', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/REVOKE UPDATE ON TABLE public\.perfis FROM authenticated, anon/);
  });

  it('perfis: GRANT UPDATE só colunas legítimas do cliente (sem is_admin/is_test)', () => {
    const sql = readMigration(SEC_MIGRATION);
    for (const col of PERFIS_COLUNAS_CLIENTE) {
      expect(sql).toMatch(new RegExp(`\\b${col}\\b`));
    }
    expect(sql).toMatch(/GRANT UPDATE \([\s\S]*?\) ON TABLE public\.perfis TO authenticated/);
    for (const forbidden of PERFIS_PROIBIDAS) {
      const grantBlock = sql.match(/GRANT UPDATE \([\s\S]*?\) ON TABLE public\.perfis/)?.[0] ?? '';
      expect(grantBlock).not.toMatch(new RegExp(`\\b${forbidden}\\b`));
    }
  });

  it('revoga EXECUTE das quatro funções internas de authenticated/PUBLIC/anon', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\._liquidate_pagamento_row/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\._create_pagamentos_periodo/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\._refresh_repasse_motorista/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.notify_domain_event/);
    expect(sql).toMatch(/FROM PUBLIC, anon, authenticated/);
  });

  it('ALTER DEFAULT PRIVILEGES revoga grants automáticos em tabelas e funções', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public/);
    expect(sql).toMatch(/REVOKE ALL ON TABLES FROM anon, authenticated/);
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated, PUBLIC/);
  });

  it('notificacoes: UPDATE só coluna lida', () => {
    const sql = readMigration(SEC_MIGRATION);
    expect(sql).toMatch(/REVOKE UPDATE ON TABLE public\.notificacoes FROM authenticated, anon/);
    expect(sql).toMatch(/GRANT UPDATE \(lida\) ON TABLE public\.notificacoes TO authenticated/);
    expect(sql).not.toMatch(/GRANT UPDATE \(lida, mensagem\)/);
  });
});
