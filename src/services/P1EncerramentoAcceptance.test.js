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

  it('leave_passenger mantém corpo PR #249 (reservado → saiu, _anular_pagamento)', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(/v_estado_antes = 'reservado'/);
    expect(sql).toMatch(/estado = 'saiu'/);
    expect(sql).toMatch(/_anular_pagamento_sem_divida/);
    expect(sql).not.toMatch(/_expirar_lugar_reservado_sem_divida/);
    expect(sql).toMatch(/Depende de #249/);
  });

  it('script prova PG leave existe', () => {
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_leave_passenger_driver_notif_pg_proof.sql'))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_leave_passenger_reservado_saiu_pg_proof.sql'))).toBe(
      true,
    );
    expect(
      existsSync(
        join(ROOT, '../../supabase/tests/fixtures/20261009190000_leave_passenger_reservado_saiu.sql'),
      ),
    ).toBe(true);
  });

  it('runner PG aplica fixture #249 antes de 200000', () => {
    const sh = readFileSync(PG_PROOF, 'utf8');
    expect(sh).toMatch(/20261009190000_leave_passenger_reservado_saiu/);
    expect(sh).toMatch(/p1_leave_passenger_reservado_saiu_pg_proof/);
  });
});
