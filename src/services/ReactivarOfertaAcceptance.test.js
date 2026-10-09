/**
 * Reactivar oferta — contrato SQL + serviço + privilégios
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
const PRIV_PROOF = join(ROOT, '../../supabase/tests/reactivar_oferta_privileges_pg_proof.sql');

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
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
    expect(sql).toMatch(/SECURITY DEFINER[\s\S]*reactivate_oferta/);
    expect(sql).toMatch(/SET search_path TO 'public'[\s\S]*reactivate_oferta/);
  });

  it('reactivate_oferta bloqueia com FOR UPDATE e verifica dono', () => {
    expect(sql).toMatch(/reactivate_oferta[\s\S]*FOR UPDATE/);
    expect(sql).toMatch(/v_uid IS DISTINCT FROM v_oferta\.driver_id/);
    expect(sql).toMatch(/Só o dono pode reactivar esta oferta/);
  });

  it('reactivate_oferta valida is_test e motivo admin/motorista', () => {
    expect(sql).toMatch(/COALESCE\(v_oferta\.is_test, false\)/);
    expect(sql).toMatch(/Oferta de teste não pode ser reactivada/);
    expect(sql).toMatch(/inactiva_motivo, ''\)\) = 'admin'/);
    expect(sql).toMatch(/inactiva_motivo, ''\)\) <> 'motorista'/);
  });

  it('reactivate_oferta valida capacidade veículo vs vagas publicadas e ocupação', () => {
    expect(sql).toMatch(/public\.oferta_ocupacao\(p_oferta_id\)/);
    expect(sql).toMatch(/v_ocupadas > v_oferta\.vagas_totais/);
    expect(sql).toMatch(/v_oferta\.vagas_totais > v_vagas_veiculo/);
  });

  it('reactivate_oferta mantém vagas_totais publicadas (não repõe capacidade do veículo)', () => {
    expect(sql).not.toMatch(/vagas_totais = v_vagas_veiculo/);
    expect(sql).toMatch(/SET[\s\S]*estado = 'disponivel'[\s\S]*inactiva_motivo = NULL/);
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

describe('Reactivar oferta — prova privilégios SQL', () => {
  const proof = readFileSync(PRIV_PROOF, 'utf8');

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
      data: { id: 'of-1', estado: 'disponivel', vagas_totais: 2 },
      error: null,
    });

    const result = await reactivateOferta('of-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reactivate_oferta', {
      p_oferta_id: 'of-1',
    });
    expect(result.estado).toBe('disponivel');
    expect(result.vagas_totais).toBe(2);
  });
});
