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
    expect(sql).toMatch(/rescisao_confirmada_em IS NOT NULL/);
    expect(sql).toMatch(/status', 'confirmado_idempotente'/);
    expect(sql).toMatch(/status', 'ja_encerrado'/);
    expect(sql).toMatch(/RETURNS jsonb/);
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

  it('leave_passenger mantém corpo 190000 + notificação e guard motorista caller', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(/IF v_estado_antes = 'reservado'/);
    expect(sql).toMatch(/_anular_pagamento_sem_divida/);
    expect(sql).not.toMatch(/_expirar_lugar_reservado_sem_divida/);
    expect(sql).toMatch(/v_uid IS DISTINCT FROM v_acordo\.driver_id/);
  });

  it('200000 leave_passenger difere de 190000 só no bloco de notificação (e decl. v_estado_acordo)', () => {
    const m190 = join(MIGRATIONS, '20261009190000_leave_passenger_reservado_saiu.sql');
    expect(existsSync(m190)).toBe(true);
    const extract = (file) => {
      const raw = readFileSync(file, 'utf8');
      const m = raw.match(/AS \$function\$([\s\S]*?)\$function\$/);
      return (m?.[1] || '').trim();
    };
    const base = extract(m190);
    const p1 = extract(join(MIGRATIONS, MIGRATION_FILE));
    const baseLines = base.split('\n');
    const p1Lines = p1.split('\n');
    const diff = [];
    const max = Math.max(baseLines.length, p1Lines.length);
    for (let i = 0; i < max; i += 1) {
      const a = baseLines[i];
      const b = p1Lines[i];
      if (a !== b) diff.push({ i, a, b });
    }
    const joinedDiff = diff.map((d) => `${d.a ?? ''}|${d.b ?? ''}`).join('\n');
    expect(joinedDiff).not.toMatch(/_expirar_lugar_reservado/);
    expect(p1).toContain('Um passageiro saiu do acordo.');
    expect(p1).toContain('v_estado_acordo');
    expect(p1).toContain('v_uid IS DISTINCT FROM v_acordo.driver_id');
    const removedFromBase = baseLines.filter((line) => !p1Lines.includes(line) && line.trim());
    expect(removedFromBase).toHaveLength(0);
  });

  it('GRANT/REVOKE leave e terminate alinhados (authenticated, sem anon)', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) TO authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) FROM anon;/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.terminate_agreement\(uuid, text, text, uuid, text\) TO authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.terminate_agreement\(uuid, text, text, uuid, text\) FROM anon;/,
    );
  });

  it('script prova PG leave e softs existe', () => {
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_leave_passenger_driver_notif_pg_proof.sql'))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_leave_passenger_reservado_saiu_pg_proof.sql'))).toBe(
      true,
    );
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_terminate_ja_encerrado_pg_proof.sql'))).toBe(true);
    expect(existsSync(join(ROOT, '../../supabase/tests/p1_leave_driver_caller_no_notif_pg_proof.sql'))).toBe(
      true,
    );
  });

  it('runner PG inclui provas P1R/P1J/P1D', () => {
    const sh = readFileSync(PG_PROOF, 'utf8');
    expect(sh).toMatch(/p1_leave_passenger_reservado_saiu_pg_proof/);
    expect(sh).toMatch(/p1_terminate_ja_encerrado_pg_proof/);
    expect(sh).toMatch(/p1_leave_driver_caller_no_notif_pg_proof/);
    expect(sh).toMatch(/p1_encerramento_motivo_pg_proof/);
    expect(sh).not.toMatch(/fixtures\/20261009190000/);
  });
});
