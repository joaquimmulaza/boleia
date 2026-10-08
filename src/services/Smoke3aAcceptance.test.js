/**
 * Smoke #3a — stepper vagas + is_test (SQL contract)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

const VAGAS_SQL = '20261008142000_smoke_3a_oferta_vagas_stepper.sql';
const IS_TEST_SQL = '20261008142100_smoke_3a_is_test_flag.sql';
const IS_TEST_RLS_SQL = '20261008142200_smoke_3a_is_test_rls_qa_participant.sql';

const JOAQUIM_OFERTAS = [
  '9da0ba16-32a6-403e-a7f6-0f34fe8eb768',
  'a8583b34-ea6f-4045-b6e9-cba0d688c7e3',
];

describe('Smoke #3a — item 5 (stepper vagas)', () => {
  it('update_oferta valida p_vagas_totais com oferta_ocupacao e vagas_passageiros', () => {
    const sql = readMigration(VAGAS_SQL);
    expect(sql).toMatch(/p_vagas_totais integer DEFAULT NULL/);
    expect(sql).toMatch(/v_ocupadas := public\.oferta_ocupacao\(p_oferta_id\)/);
    expect(sql).toMatch(/v\.vagas_passageiros/);
    expect(sql).toMatch(/Não podes reduzir abaixo de % lugares/);
    expect(sql).toMatch(/O veículo só tem % lugares para passageiros/);
    expect(sql).toMatch(/PERFORM public\.recount_oferta_vagas\(p_oferta_id\)/);
    expect(sql).toMatch(/vagas_totais = v_vagas_alvo/);
  });
});

describe('Smoke #3a — item 10 (is_test)', () => {
  it('adiciona is_test, qa_accounts allowlist e filtra RLS', () => {
    const sql = readMigration(IS_TEST_SQL);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.qa_accounts/);
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.qa_accounts FROM authenticated/);
    expect(sql).toMatch(/is_qa_test_owner_email/);
    expect(sql).toMatch(/seed: email pattern snapshot/);
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM public\.qa_accounts q WHERE q\.user_id = NEW\.driver_id\)/);
    expect(sql).toMatch(/trg_ofertas_marketplace_is_test/);
    expect(sql).toMatch(/trg_procuras_marketplace_is_test/);
    expect(sql).toMatch(/AND NOT is_test/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.is_qa_test_owner_email/);
  });

  it('viewer_is_qa usa qa_accounts — não padrões de email em runtime', () => {
    const sql = readMigration(IS_TEST_RLS_SQL);
    expect(sql).toMatch(/FROM public\.qa_accounts q[\s\S]*WHERE q\.user_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(/is_qa_test_owner_email/);
  });

  it('RLS autenticados: helpers SECURITY DEFINER sem EXISTS recursivo nas policies', () => {
    const sql = readMigration(IS_TEST_RLS_SQL);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.viewer_is_qa\(\)/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.viewer_is_oferta_participant\(p_oferta_id uuid\)/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.viewer_is_procura_participant\(p_procura_id uuid\)/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.viewer_is_oferta_participant\(uuid\) FROM PUBLIC/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.viewer_is_procura_participant\(uuid\) FROM anon/);
    expect(sql).toMatch(
      /OR \(is_test AND public\.viewer_is_oferta_participant\(id\)\)/,
    );
    expect(sql).toMatch(
      /OR \(is_test AND public\.viewer_is_procura_participant\(id\)\)/,
    );
    expect(sql).not.toMatch(/CREATE POLICY ofertas_select_autenticados[\s\S]*EXISTS \(/);
    expect(sql).not.toMatch(/CREATE POLICY procuras_select_autenticados[\s\S]*EXISTS \(/);
  });

  it('browse/matching usa SELECT directo — filtro is_test via RLS (sem RPC browse)', () => {
    const rls = readMigration(IS_TEST_RLS_SQL);
    expect(rls).toMatch(/ofertas_select_autenticados/);
    expect(rls).toMatch(/procuras_select_autenticados/);
    const base = readMigration(IS_TEST_SQL);
    expect(base).toMatch(/ofertas_select_anon_browse[\s\S]*AND NOT is_test/);
    expect(base).not.toMatch(/CREATE OR REPLACE FUNCTION public\.list_ofertas/);
  });

  it('backfill 18 ofertas de teste e garante ofertas do Joaquim com is_test false', () => {
    const sql = readMigration(IS_TEST_SQL);
    expect(sql).toMatch(/f230fdb5-3de4-434e-950f-dd25b7460e1c/);
    expect(sql).toMatch(/08b55f87-b2ec-4df1-bd75-ef824aff5273/);
    for (const id of JOAQUIM_OFERTAS) {
      expect(sql).toMatch(new RegExp(id));
    }
    expect(sql).toMatch(/SET is_test = false[\s\S]*9da0ba16-32a6-403e-a7f6-0f34fe8eb768/);
  });
});
