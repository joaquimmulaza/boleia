/**
 * cancel_procura — membros_grupo saiu + fecho de grupo (contrato SQL + serviço)
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cancelProcura } from './ProcuraService.js';
import { supabase } from '../lib/supabase';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FILE = '20261009170000_cancel_procura_membros_saiu.sql';
const LEGACY_CANCEL = '20260908225833_editar_procura_update_cancel_rpc.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

/** @returns {string} */
function cancelProcuraFunctionBody() {
  const sql = readMigration(MIGRATION_FILE);
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION public\.cancel_procura[\s\S]*?\n\$\$;/,
  );
  if (!match) throw new Error('cancel_procura não encontrada na migração nova');
  return match[0];
}

vi.mock('../lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

describe('cancel_procura membros — migração obrigatória', () => {
  it('ficheiro de migração 20261009170000 existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
  });

  /** @type {string} */
  let sql;
  beforeAll(() => {
    sql = readMigration(MIGRATION_FILE);
  });

  it('adiciona saiu_em em membros_grupo (schema não tinha a coluna)', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS saiu_em timestamptz/);
  });

  it('adiciona estado aberto|fechado em grupos', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS estado text/);
    expect(sql).toMatch(/fechado/);
  });

  it('cancel_procura marca o passageiro cancelador activo→saiu com saiu_em', () => {
    const body = cancelProcuraFunctionBody();
    expect(body).toMatch(/UPDATE public\.membros_grupo/);
    expect(body).toMatch(/estado = 'saiu'/);
    expect(body).toMatch(/saiu_em/);
    expect(body).toMatch(/passenger_id = v_uid/);
    expect(body).toMatch(/lower\(estado\) = 'activo'/);
  });

  it('fecha grupo só sem membros activos', () => {
    const body = cancelProcuraFunctionBody();
    expect(body).toMatch(/estado = 'fechado'/);
    expect(body).toMatch(/v_n_activos/);
  });

  it('backfill só is_test em procuras canceladas', () => {
    expect(sql).toMatch(/p\.is_test\s*=\s*true/);
    expect(sql).toMatch(/lower\(p\.estado\)\s*=\s*'cancelada'/);
  });

  it('mantém SECURITY DEFINER, search_path e GRANT authenticated', () => {
    const body = cancelProcuraFunctionBody();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.cancel_procura\(uuid\) TO authenticated/,
    );
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.cancel_procura\(uuid\) FROM anon/);
  });

  it('não altera acordos nem acordos_passageiros', () => {
    const body = cancelProcuraFunctionBody();
    expect(body).not.toMatch(/UPDATE public\.acordos/);
    expect(body).not.toMatch(/UPDATE public\.acordos_passageiros/);
  });
});

describe('cancel_procura legado — regressão conhecida em main', () => {
  it('versão antiga não actualiza membros_grupo', () => {
    const legacy = readMigration(LEGACY_CANCEL);
    const fn = legacy.match(
      /CREATE OR REPLACE FUNCTION public\.cancel_procura[\s\S]*?\n\$\$;/,
    )?.[0];
    expect(fn).toBeTruthy();
    expect(fn).not.toMatch(/membros_grupo/);
  });
});

describe('cancelProcura — serviço', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('continua a chamar RPC cancel_procura', async () => {
    supabase.rpc.mockResolvedValue({ data: { id: 'pr-1' }, error: null });
    await cancelProcura('pr-1');
    expect(supabase.rpc).toHaveBeenCalledWith('cancel_procura', {
      p_procura_id: 'pr-1',
    });
  });
});
