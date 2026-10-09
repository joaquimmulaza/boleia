/**
 * Reactivar oferta — contrato SQL + serviço
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

describe('Reactivar oferta — migration', () => {
  it('define colunas, cancel_oferta com motivo motorista e RPC reactivate_oferta', () => {
    const sql = readMigration(REACTIVAR_SQL);
    expect(sql).toMatch(/inactiva_motivo text/);
    expect(sql).toMatch(/hidden_by_admin boolean NOT NULL DEFAULT false/);
    expect(sql).toMatch(/inactiva_motivo = 'motorista'/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.reactivate_oferta/);
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(/COALESCE\(v_oferta\.is_test, false\)/);
    expect(sql).toMatch(/hidden_by_admin/);
    expect(sql).toMatch(/public\.oferta_ocupacao\(p_oferta_id\)/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.reactivate_oferta\(uuid\) TO authenticated/);
    expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.reactivate_oferta\(uuid\) TO anon/);
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
      data: { id: 'of-1', estado: 'disponivel' },
      error: null,
    });

    const result = await reactivateOferta('of-1');

    expect(supabase.rpc).toHaveBeenCalledWith('reactivate_oferta', {
      p_oferta_id: 'of-1',
    });
    expect(result.estado).toBe('disponivel');
  });
});
