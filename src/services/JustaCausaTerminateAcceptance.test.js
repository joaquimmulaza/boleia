import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FIX = '20261012143100_justa_causa_notif_terminado.sql';
const MIGRATION_B4 = '20261009230000_notif_b4_txid_cancel_suppress.sql';

function readMigration(name) {
  return readFileSync(join(MIGRATIONS, name), 'utf8');
}

/**
 * Bloco INSERT suppress + finalize até v_mensagem, identificado pelo reason estável.
 * @param {string} sql
 * @param {'terminate_justa_causa' | 'terminate_consensual_immediate'} reason
 */
function extractTerminateSuppressBlock(sql, reason) {
  const reasonNeedle = `'${reason}'`;
  const reasonIdx = sql.indexOf(reasonNeedle);
  if (reasonIdx < 0) return '';
  const insertStart = sql.lastIndexOf(
    'INSERT INTO public._acordo_cancel_notif_suppress',
    reasonIdx,
  );
  const msgIdx = sql.indexOf('v_mensagem :=', reasonIdx);
  if (insertStart < 0 || msgIdx < insertStart) return '';
  return sql.slice(insertStart, msgIdx);
}

function expectSuppressBeforeFinalize(block) {
  expect(block).toContain('_acordo_cancel_notif_suppress');
  expect(block).toContain('_p0_finalize_lugares_rescisao_imediata');
  const suppressIdx = block.indexOf('_acordo_cancel_notif_suppress');
  const finalizeIdx = block.indexOf('_p0_finalize_lugares_rescisao_imediata');
  expect(finalizeIdx).toBeGreaterThan(suppressIdx);
  expect(block).toMatch(/suppress_driver, suppress_passenger[\s\S]{0,200}true, true/);
}

describe('justa causa — terminate_agreement (migração 20261012143100)', () => {
  it('migração de fix existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FIX))).toBe(true);
  });

  it('activa RLS na tabela _acordo_cancel_notif_suppress', () => {
    const sql = readMigration(MIGRATION_FIX);
    expect(sql).toMatch(
      /ALTER TABLE IF EXISTS public\._acordo_cancel_notif_suppress ENABLE ROW LEVEL SECURITY/,
    );
  });

  it('supressão txid ANTES de _p0_finalize no ramo justa_causa', () => {
    const sql = readMigration(MIGRATION_FIX);
    const block = extractTerminateSuppressBlock(sql, 'terminate_justa_causa');
    expect(block).toContain('terminate_justa_causa');
    expectSuppressBeforeFinalize(block);
  });

  it('supressão txid ANTES de _p0_finalize no consensual imediato confirmado', () => {
    const sql = readMigration(MIGRATION_FIX);
    const block = extractTerminateSuppressBlock(sql, 'terminate_consensual_immediate');
    expect(block).toContain('terminate_consensual_immediate');
    expectSuppressBeforeFinalize(block);
  });

  it('passa motivo canónico de lugar Terminado para reservados', () => {
    const sql = readMigration(MIGRATION_FIX);
    expect(sql).toContain('Rescisão por justa causa');
    expect(sql).toMatch(
      /_p0_finalize_lugares_rescisao_imediata\(\s*[\s\S]*Rescisão por justa causa/,
    );
  });

  it('corpo prod anterior (B4): justa_causa sem suppress txid — FAIL-on-old', () => {
    const sql = readMigration(MIGRATION_B4);
    const marker = "v_mensagem := 'A outra parte rescindiu o acordo por justa causa.'";
    const idx = sql.indexOf(marker);
    expect(idx).toBeGreaterThan(-1);
    const slice = sql.slice(Math.max(0, idx - 900), idx);
    expect(slice.indexOf('_acordo_cancel_notif_suppress')).toBe(-1);
    expect(slice).toContain('_p0_finalize_lugares_rescisao_imediata');
  });

  it('corpo prod anterior (B4): consensual imediato finalize antes do suppress — FAIL-on-old', () => {
    const sql = readMigration(MIGRATION_B4);
    const reasonIdx = sql.indexOf("'terminate_consensual_immediate'");
    expect(reasonIdx).toBeGreaterThan(-1);
    const finalizeIdx = sql.lastIndexOf(
      'PERFORM public._p0_finalize_lugares_rescisao_imediata',
      reasonIdx,
    );
    const suppressIdx = sql.lastIndexOf(
      'INSERT INTO public._acordo_cancel_notif_suppress',
      reasonIdx,
    );
    expect(finalizeIdx).toBeGreaterThan(-1);
    expect(suppressIdx).toBeGreaterThan(finalizeIdx);
  });
});

describe('justa causa — prova PG', () => {
  it('script SQL de replay existe', () => {
    expect(
      existsSync(join(ROOT, '../../supabase/tests/justa_causa_notif_terminado_pg_proof.sql')),
    ).toBe(true);
  });

  it('prova PG inclui consensual imediato confirmado (JC6)', () => {
    const proof = readFileSync(
      join(ROOT, '../../supabase/tests/justa_causa_notif_terminado_pg_proof.sql'),
      'utf8',
    );
    expect(proof).toContain('PASS JC6');
    expect(proof).toContain('A rescisão consensual foi confirmada');
    expect(proof).not.toMatch(/WHEN OTHERS THEN\s*\n\s*v_forge_ok := false/);
  });
});
