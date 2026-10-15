/**
 * Sprint UX — motorista notificado em saída/expiração (G1–G3).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  NOTIF_TITULO_V1_7,
  NOTIF_TITULO_V1_8,
  NOTIF_TITULO_V1_12,
} from '../utils/notificationStatusCardCopy.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION = '20261012220000_driver_notif_passenger_exit.sql';
const MIGRATION_V114 = '20261012221000_passenger_removed_last_v1_14.sql';

function readMigration() {
  return readFileSync(join(MIGRATIONS, MIGRATION), 'utf8');
}

describe('Driver notif passenger exit — migração', () => {
  it('ficheiro de migração existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION))).toBe(true);
  });

  it('G1: leave_passenger notifica em cancelamento_pendente (não só activo)', () => {
    const sql = readMigration();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
    expect(sql).toMatch(
      /lower\(v_estado_acordo\)\s+IN\s*\(\s*'activo'\s*,\s*'cancelamento_pendente'\s*\)/,
    );
  });

  it('G2: apply_due_reserva_expiry card v1.12 com copy final', () => {
    const sql = readMigration();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_due_reserva_expiry/);
    expect(sql).toMatch(/NOT v_fecha_todo_lote/);
    expect(sql).toMatch(
      /lower\(v_row\.acordo_estado\)\s+IN\s*\(\s*'activo'\s*,\s*'cancelamento_pendente'\s*\)/,
    );
    expect(sql).toMatch(/'card',\s*'v1\.12'/);
    expect(sql).toMatch(/'titulo',\s*'Ficou um lugar livre'/);
    expect(sql).toContain('A reserva de ');
    expect(sql).toContain(' expirou. O acordo continua.');
    expect(sql).toContain('A reserva de um passageiro expirou. O acordo continua.');
    expect(sql).toContain(NOTIF_TITULO_V1_12);
  });

  it('G3: leave_passenger metadata card v1.7 / v1.8 + títulos aprovados', () => {
    const sql = readMigration();
    expect(sql).toMatch(/'card',\s*'v1\.7'/);
    expect(sql).toMatch(/'card',\s*'v1\.8'/);
    expect(sql).toMatch(new RegExp(`'titulo',\\s*'${NOTIF_TITULO_V1_7.replace(/'/g, "''")}'`));
    expect(sql).toMatch(new RegExp(`'titulo',\\s*'${NOTIF_TITULO_V1_8.replace(/'/g, "''")}'`));
  });

  it('v1.14: leave_passenger card passageiro removido (último)', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_V114))).toBe(true);
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_V114), 'utf8');
    expect(sql).toMatch(/'card',\s*'v1\.14'/);
    expect(sql).toMatch(/'titulo',\s*'Acordo encerrado'/);
    expect(sql).toContain('O motorista retirou-te do acordo, que foi encerrado.');
    expect(sql).toContain('→');
    expect(sql).toMatch(/last_passenger_driver_removed[\s\S]{0,80}true, true/);
    expect(sql).toMatch(/tipo,\s*metadata\)/);
    expect(sql).not.toMatch(/'error'/);
  });

  it('script prova PG dedicado', () => {
    expect(
      existsSync(join(ROOT, '../../supabase/tests/driver_notif_passenger_exit_pg_proof.sql')),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, '../../scripts/run-driver-notif-passenger-exit-pg-proof.sh')),
    ).toBe(true);
  });
});
