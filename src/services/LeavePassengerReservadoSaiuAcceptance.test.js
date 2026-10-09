/**
 * Contrato: saída voluntária em reservado → acordos_passageiros.estado = saiu (não expirado).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const FIX_MIGRATION = '20261009190000_leave_passenger_reservado_saiu.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('leave_passenger — reservado marca saiu (não expirado)', () => {
  /** @type {string} */
  let sql;

  beforeAll(() => {
    expect(existsSync(join(MIGRATIONS, FIX_MIGRATION))).toBe(true);
    sql = readMigration(FIX_MIGRATION);
  });

  it('migração 20261009190000 existe', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
  });

  it('ramo reservado: UPDATE estado = saiu (sem _expirar_lugar_reservado_sem_divida)', () => {
    const body = sql.match(
      /CREATE OR REPLACE FUNCTION public\.leave_passenger[\s\S]*?AS \$function\$([\s\S]*)\$function\$;/,
    )?.[1];
    expect(body).toBeTruthy();
    expect(body).toMatch(/IF v_estado_antes = 'reservado' THEN[\s\S]*estado = 'saiu'/);
    expect(body).not.toMatch(
      /IF v_estado_antes = 'reservado' THEN[\s\S]*_expirar_lugar_reservado_sem_divida/,
    );
  });

  it('anula pagamento com motivo saída voluntária', () => {
    expect(sql).toMatch(/Saíste antes da activação do lugar/);
    expect(sql).toMatch(/_anular_pagamento_sem_divida/);
  });

  it('GRANT authenticated EXECUTE em leave_passenger', () => {
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) TO authenticated/,
    );
  });
});
