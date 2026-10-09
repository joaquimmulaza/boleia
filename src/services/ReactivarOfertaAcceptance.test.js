/**
 * Reactivar oferta — contrato SQL + serviço + privilégios + is_test (Smoke #3a)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reactivateOferta } from './OfertaService.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const REACTIVAR_SQL = '20261009143000_reactivar_oferta_rpc.sql';
const IS_TEST_SQL = '20261008142100_smoke_3a_is_test_flag.sql';
const IS_TEST_RLS_SQL = '20261008142200_smoke_3a_is_test_rls_qa_participant.sql';
const PRIV_PROOF = join(ROOT, '../../supabase/tests/reactivar_oferta_privileges_pg_proof.sql');
const OFERTA_SERVICE = join(ROOT, './OfertaService.js');

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

/** @returns {string} */
function reactivateOfertaFunctionBody() {
  const sql = readMigration(REACTIVAR_SQL);
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION public\.reactivate_oferta[\s\S]*?\n\$\$;/,
  );
  if (!match) throw new Error('reactivate_oferta não encontrada na migração');
  return match[0];
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('Reactivar oferta — migration (contrato obrigatório)', () => {
  const sql = readMigration(REACTIVAR_SQL);

  it('coluna inactiva_motivo motorista|admin', () => {
    expect(sql).toMatch(/inactiva_motivo text[\s\S]*'motorista', 'admin'/);
  });

  it('remove hidden_by_admin se existir', () => {
    expect(sql).toMatch(/DROP COLUMN IF EXISTS hidden_by_admin/);
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS hidden_by_admin/);
  });

  it('cancel_oferta grava motivo motorista', () => {
    expect(sql).toMatch(/inactiva_motivo = 'motorista'/);
  });

  it('reactivate_oferta existe com SECURITY DEFINER e search_path', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.reactivate_oferta/);
    const body = reactivateOfertaFunctionBody();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path TO 'public'/);
  });

  it('reactivate_oferta bloqueia com FOR UPDATE e verifica dono', () => {
    const body = reactivateOfertaFunctionBody();
    expect(body).toMatch(/FOR UPDATE/);
    expect(body).toMatch(/v_uid IS DISTINCT FROM v_oferta\.driver_id/);
    expect(body).toMatch(/Só o dono pode reactivar esta oferta/);
  });

  it('reactivate_oferta não bloqueia is_test (motorista QA)', () => {
    const body = reactivateOfertaFunctionBody();
    expect(body).not.toMatch(/Oferta de teste não pode ser reactivada/);
    expect(body).not.toMatch(/IF COALESCE\(v_oferta\.is_test/);
  });

  it('reactivate UPDATE não altera is_test', () => {
    const body = reactivateOfertaFunctionBody();
    const updateMatch = body.match(
      /UPDATE public\.ofertas_capacidade[\s\S]*?RETURNING \* INTO v_oferta;/,
    );
    expect(updateMatch).toBeTruthy();
    expect(updateMatch[0]).not.toMatch(/\bis_test\b/);
  });

  it('reactivate_oferta valida motivo admin/motorista', () => {
    const body = reactivateOfertaFunctionBody();
    expect(body).toMatch(/inactiva_motivo, ''\)\) = 'admin'/);
    expect(body).toMatch(/inactiva_motivo, ''\)\) <> 'motorista'/);
  });

  it('reactivate_oferta valida capacidade veículo vs vagas publicadas e ocupação', () => {
    const body = reactivateOfertaFunctionBody();
    expect(body).toMatch(/public\.oferta_ocupacao\(p_oferta_id\)/);
    expect(body).toMatch(/v_ocupadas > v_oferta\.vagas_totais/);
    expect(body).toMatch(/v_oferta\.vagas_totais > v_vagas_veiculo/);
  });

  it('reactivate_oferta mantém vagas_totais publicados (não repõe capacidade do veículo)', () => {
    const body = reactivateOfertaFunctionBody();
    expect(body).not.toMatch(/vagas_totais = v_vagas_veiculo/);
    expect(body).toMatch(/SET[\s\S]*estado = 'disponivel'[\s\S]*inactiva_motivo = NULL/);
  });

  it('revoke UPDATE client e remove policy ofertas_update_proprio', () => {
    expect(sql).toMatch(/REVOKE UPDATE ON TABLE public\.ofertas_capacidade FROM authenticated/);
    expect(sql).toMatch(/REVOKE UPDATE ON TABLE public\.ofertas_capacidade FROM anon/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS ofertas_update_proprio ON public\.ofertas_capacidade/);
  });

  it('GRANT EXECUTE reactivate_oferta só authenticated', () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reactivate_oferta\(uuid\) TO authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.reactivate_oferta\(uuid\) TO anon/);
  });
});

describe('Reactivar oferta — is_test reactivada invisível a passageiros reais (Smoke #3a / PR #224)', () => {
  it('RLS anon browse: AND NOT is_test (20261008142100)', () => {
    const sql = readMigration(IS_TEST_SQL);
    expect(sql).toMatch(/ofertas_select_anon_browse[\s\S]*AND NOT is_test/);
  });

  it('RLS autenticado: NOT is_test OR driver_id = auth.uid() (20261008142100)', () => {
    const sql = readMigration(IS_TEST_SQL);
    expect(sql).toMatch(/ofertas_select_autenticados[\s\S]*NOT is_test OR driver_id = auth\.uid\(\)/);
  });

  it('participantes QA vêem is_test via viewer_is_oferta_participant (20261008142200)', () => {
    const sql = readMigration(IS_TEST_RLS_SQL);
    expect(sql).toMatch(
      /OR \(is_test AND public\.viewer_is_oferta_participant\(id\)\)/,
    );
  });

  it('listOfertasDisponiveis não filtra is_test no cliente — depende da RLS', () => {
    const src = readFileSync(OFERTA_SERVICE, 'utf8');
    const fn = src.match(/export async function listOfertasDisponiveis[\s\S]*?^}/m);
    expect(fn).toBeTruthy();
    expect(fn[0]).not.toMatch(/is_test/);
    expect(fn[0]).toMatch(/\.from\('ofertas_capacidade'\)/);
  });
});

describe('Reactivar oferta — prova privilégios SQL', () => {
  const proof = readFileSync(PRIV_PROOF, 'utf8');

  it('só assert has_* — não aplica REVOKE (migração é a fonte)', () => {
    expect(proof).not.toMatch(/REVOKE UPDATE ON TABLE public\.ofertas_capacidade/);
  });

  it('usa has_table_privilege e has_column_privilege para colunas sensíveis', () => {
    expect(proof).toMatch(/has_table_privilege\('authenticated', 'public\.ofertas_capacidade', 'UPDATE'\)/);
    expect(proof).toMatch(/has_column_privilege\('authenticated', 'public\.ofertas_capacidade', 'estado', 'UPDATE'\)/);
    expect(proof).toMatch(/has_column_privilege\('authenticated', 'public\.ofertas_capacidade', 'is_test', 'UPDATE'\)/);
    expect(proof).toMatch(/has_column_privilege\('authenticated', 'public\.ofertas_capacidade', 'inactiva_motivo', 'UPDATE'\)/);
    expect(proof).toMatch(/has_column_privilege\('authenticated', 'public\.ofertas_capacidade', 'vagas_totais', 'UPDATE'\)/);
    expect(proof).toMatch(/has_column_privilege\('authenticated', 'public\.ofertas_capacidade', 'vagas_disponiveis', 'UPDATE'\)/);
  });
});

describe('Reactivar oferta — OfertaService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'driver-1' } },
    });
  });

  it('chama RPC reactivate_oferta', async () => {
    supabase.rpc.mockResolvedValue({
      data: { id: 'of-1', estado: 'disponivel', vagas_totais: 2, is_test: true },
      error: null,
    });

    const result = await reactivateOferta('of-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reactivate_oferta', {
      p_oferta_id: 'of-1',
    });
    expect(result.estado).toBe('disponivel');
    expect(result.vagas_totais).toBe(2);
    expect(result.is_test).toBe(true);
  });
});
