/**
 * P1 encerramento — contrato migração + scripts prova PG.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FILE = '20261009200000_p1_encerramento_gaps.sql';
const PG_PROOF = join(ROOT, '../../scripts/run-p1-encerramento-pg-proof.sh');

describe('P1 encerramento — regra 1 (terminate idempotente)', () => {
  it('migração P1 existe e alarga no-op consensual pós-confirmação', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(/rescisao_solicitada_por IS DISTINCT FROM v_uid/);
    expect(sql).toMatch(/lower\(v_acordo\.estado\) <> 'activo'/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.terminate_agreement/);
  });

  it('script prova PG terminate existe', () => {
    expect(existsSync(PG_PROOF)).toBe(true);
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_terminate_confirm_idempotent_pg_proof.sql'))).toBe(
      true,
    );
  });
});

describe('P1 encerramento — regra 3 (notificação motorista leave)', () => {
  it('leave_passenger notifica motorista em saída parcial', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(/Um passageiro saiu do acordo\./);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
  });

  it('script prova PG leave existe', () => {
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_leave_passenger_driver_notif_pg_proof.sql'))).toBe(
      true,
    );
  });
});
