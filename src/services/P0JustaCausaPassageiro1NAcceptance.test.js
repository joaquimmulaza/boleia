import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FIX = '20261012210000_justa_causa_passageiro_1n.sql';
const MIGRATION_OLD = '20261012180500_consensual_pending_block_reinit.sql';

function readMigration(name) {
  return readFileSync(join(MIGRATIONS, name), 'utf8');
}

function extractJustaCausaPassengerBlock(sql) {
  const start = sql.indexOf('IF NOT v_is_driver THEN');
  const driverMarker = sql.indexOf("v_mensagem := 'A outra parte rescindiu o acordo por justa causa.'");
  if (start < 0 || driverMarker < start) return '';
  const end = sql.lastIndexOf('ELSE', driverMarker);
  if (end < start) return '';
  return sql.slice(start, end);
}

function extractJustaCausaDriverBlock(sql) {
  const marker = "v_mensagem := 'A outra parte rescindiu o acordo por justa causa.'";
  const idx = sql.indexOf(marker);
  if (idx < 0) return '';
  const elseStart = sql.lastIndexOf('ELSE', idx);
  return sql.slice(elseStart, idx + marker.length);
}

describe('P0 justa causa passageiro 1:N — terminate_agreement', () => {
  it('migração de fix existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FIX))).toBe(true);
  });

  it('ramo passageiro: não chama _p0_finalize_lugares_rescisao_imediata no acordo inteiro', () => {
    const sql = readMigration(MIGRATION_FIX);
    const paxBlock = extractJustaCausaPassengerBlock(sql);
    expect(paxBlock).toContain('IF NOT v_is_driver THEN');
    expect(paxBlock).not.toContain('_p0_finalize_lugares_rescisao_imediata');
    expect(paxBlock).toContain('ajustar_obrigacao_pagamento_mes');
    expect(paxBlock).toContain('_maybe_fechar_acordo_sem_lugares_vivos');
  });

  it('ramo motorista: mantém finalize imediato do acordo', () => {
    const sql = readMigration(MIGRATION_FIX);
    const driverBlock = extractJustaCausaDriverBlock(sql);
    expect(driverBlock).toContain('_p0_finalize_lugares_rescisao_imediata');
    expect(driverBlock).toContain('cancelado_justificado');
  });

  it('FAIL-on-old: main 20261012180500 finalize todos no justa_causa', () => {
    const sql = readMigration(MIGRATION_OLD);
    expect(sql).not.toContain('IF NOT v_is_driver THEN');
    expect(sql).toMatch(
      /terminate_justa_causa[\s\S]{0,400}_p0_finalize_lugares_rescisao_imediata/,
    );
  });
});

describe('P0 justa causa passageiro 1:N — prova PG', () => {
  it('script SQL de replay existe', () => {
    expect(
      existsSync(join(ROOT, '../../supabase/tests/p0_justa_causa_passageiro_1n_pg_proof.sql')),
    ).toBe(true);
  });
});
