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

/** Bloco justa_causa dentro de terminate_agreement (após ELSE final do consensual). */
function extractJustaCausaTerminateBlock(sql) {
  const marker = "v_mensagem := 'A outra parte rescindiu o acordo por justa causa.'";
  const idx = sql.indexOf(marker);
  if (idx < 0) return '';
  const start = sql.lastIndexOf('ELSE', idx);
  return sql.slice(start, idx + marker.length);
}

describe('justa causa — terminate_agreement (migração 20261012143100)', () => {
  it('migração de fix existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FIX))).toBe(true);
  });

  it('supressão txid ANTES de _p0_finalize no ramo justa_causa', () => {
    const sql = readMigration(MIGRATION_FIX);
    const block = extractJustaCausaTerminateBlock(sql);
    expect(block).toContain('_acordo_cancel_notif_suppress');
    expect(block).toContain('terminate_justa_causa');
    const suppressIdx = block.indexOf('_acordo_cancel_notif_suppress');
    const finalizeIdx = block.indexOf('_p0_finalize_lugares_rescisao_imediata');
    expect(suppressIdx).toBeGreaterThan(-1);
    expect(finalizeIdx).toBeGreaterThan(suppressIdx);
    expect(block).toMatch(/suppress_driver, suppress_passenger[\s\S]{0,80}true, true/);
  });

  it('passa motivo canónico de lugar Terminado para reservados', () => {
    const sql = readMigration(MIGRATION_FIX);
    expect(sql).toContain('Rescisão por justa causa');
    expect(sql).toMatch(
      /_p0_finalize_lugares_rescisao_imediata\(\s*[\s\S]*Rescisão por justa causa/,
    );
  });

  it('corpo prod anterior (B4) não suprimia antes de _p0_finalize — FAIL-on-old', () => {
    const sql = readMigration(MIGRATION_B4);
    const block = extractJustaCausaTerminateBlock(sql);
    expect(block.indexOf('_acordo_cancel_notif_suppress')).toBe(-1);
    expect(block.indexOf('_p0_finalize_lugares_rescisao_imediata')).toBeGreaterThan(-1);
  });
});

describe('justa causa — prova PG', () => {
  it('script SQL de replay existe', () => {
    expect(
      existsSync(join(ROOT, '../../supabase/tests/justa_causa_notif_terminado_pg_proof.sql')),
    ).toBe(true);
  });
});
