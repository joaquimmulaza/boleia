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
const PG_PROOF = join(ROOT, '../../scripts/run-cancel-procura-membros-pg-proof.sh');

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

/** @returns {string} */
function leaveGrupoFunctionBody() {
  const sql = readMigration(MIGRATION_FILE);
  const match = sql.match(
    /CREATE OR REPLACE FUNCTION public\.leave_grupo_membro[\s\S]*?\n\$function\$/,
  );
  if (!match) throw new Error('leave_grupo_membro não encontrada na migração nova');
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

  it('script de prova PG aplica cadeia completa main (incl. 160000) + 170000', () => {
    expect(existsSync(PG_PROOF)).toBe(true);
    const sh = readFileSync(PG_PROOF, 'utf8');
    expect(sh).toMatch(/bootstrap_roles_first\.sql/);
    expect(sh).toMatch(/bootstrap_local_supabase\.sql/);
    expect(sh).toMatch(/supabase\/migrations\/\*\.sql/);
    expect(sh).not.toMatch(/sec-default-privileges/);
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

  it('helper _sync_grupo_pos_cancel_procura: owner saiu, pendente rejeitado, fecha só sem activos', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\._sync_grupo_pos_cancel_procura/);
    expect(sql).toMatch(/estado = 'rejeitado'/);
    expect(sql).toMatch(/lower\(estado\) = 'pendente'/);
    expect(sql).toMatch(/PERFORM public\._sync_grupo_pos_cancel_procura/);
  });

  it('cancel_procura usa helper (não fecha grupo com activos restantes)', () => {
    const body = cancelProcuraFunctionBody();
    expect(body).toMatch(/PERFORM public\._sync_grupo_pos_cancel_procura/);
    expect(body).not.toMatch(/UPDATE public\.membros_grupo[\s\S]*rejeitado/);
  });

  it('leave_grupo_membro: procura cancelada permite último activo; saiu_em; fecha sem activos', () => {
    const body = leaveGrupoFunctionBody();
    expect(body).toMatch(/v_procura_estado <> 'cancelada' AND v_n_activos <= 1/);
    expect(body).toMatch(/saiu_em = v_now/);
    expect(body).toMatch(/_close_grupo_se_zero_activos/);
    expect(body).toMatch(/FROM public\.procuras p[\s\S]*FOR UPDATE[\s\S]*FROM public\.grupos g[\s\S]*FOR UPDATE/);
  });

  it('INSERT guard: grupo aberto + procura activa|em_negociacao', () => {
    expect(sql).toMatch(/trg_membros_grupo_insert_estado_guard/);
    expect(sql).toMatch(/v_grupo_estado <> 'aberto'/);
    expect(sql).toMatch(/'activa', 'em_negociacao'/);
    expect(sql).toMatch(/membros_insert_envolvidos/);
  });

  it('passenger update guard bloqueia activo|pendente com grupo fechado ou procura cancelada', () => {
    expect(sql).toMatch(/trg_membros_grupo_passenger_update_guard/);
    expect(sql).toMatch(/v_grupo_estado = 'fechado' OR v_procura_estado = 'cancelada'/);
    expect(sql).toMatch(/lower\(NEW\.estado\) IN \('activo', 'pendente'\)/);
    expect(sql).toMatch(/RAISE EXCEPTION 'Este grupo está fechado.'/);
    expect(sql).toMatch(/NEW\.saiu_em := NULL/);
  });

  it('backfill is_test chama _sync_grupo_pos_cancel_procura por grupo cancelado', () => {
    expect(sql).toMatch(/p\.is_test = true/);
    expect(sql).toMatch(/PERFORM public\._sync_grupo_pos_cancel_procura/);
  });

  it('mantém SECURITY DEFINER, search_path e GRANT authenticated', () => {
    const body = cancelProcuraFunctionBody();
    expect(body).toMatch(/SECURITY DEFINER/);
    expect(body).toMatch(/SET search_path TO 'public'/);
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.cancel_procura\(uuid\) TO authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.leave_grupo_membro\(uuid, uuid, uuid\) TO authenticated/,
    );
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
