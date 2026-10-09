/**
 * Contrato encerramento_motivo — migração, leave_passenger (não _maybe_fechar), select via *.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FILE = '20261009235000_acordo_encerramento_motivo.sql';
const MIGRATION_LEAVE = '20261010000000_encerramento_motivo_leave_passenger.sql';
const MIGRATION_BACKFILL = '20261010000100_encerramento_motivo_backfill.sql';
const MIGRATION_COUNT_LUGARES_VIVOS =
  '20261010000200_count_lugares_vivos_acordo.sql';
const BASE_LEAVE_MIGRATION = '20261009230000_notif_b4_txid_cancel_suppress.sql';

/** @param {string} raw */
function extractLeavePassengerBody(raw) {
  const m = raw.match(
    /CREATE OR REPLACE FUNCTION public\.leave_passenger[\s\S]*?\$function\$;/,
  );
  return m?.[0] || '';
}

describe('Acordo encerramento_motivo — contrato', () => {
  it('migração adiciona coluna CHECK e redefine leave_passenger (não _maybe_fechar)', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(/encerramento_motivo/);
    expect(sql).toMatch(/sem_lugares_vivos/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.leave_passenger/);
    expect(sql).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\._maybe_fechar_acordo_sem_lugares_vivos/,
    );
    expect(sql).toMatch(/ofertas_capacidade.*is_test/s);
  });

  it('leave_passenger: diff vs prod 235000 — IF v_ultimo + gate consensual pendente', () => {
    const base = extractLeavePassengerBody(
      readFileSync(join(MIGRATIONS, BASE_LEAVE_MIGRATION), 'utf8'),
    );
    const prod235 = extractLeavePassengerBody(
      readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8'),
    );
    const next = extractLeavePassengerBody(
      readFileSync(join(MIGRATIONS, MIGRATION_LEAVE), 'utf8'),
    );
    expect(base).toContain('PERFORM public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id);');
    expect(base).toContain('_acordo_cancel_notif_suppress');
    expect(prod235).toContain("encerramento_motivo = 'sem_lugares_vivos'");
    expect(prod235).toMatch(
      /_maybe_fechar_acordo_sem_lugares_vivos\(p_acordo_id\);\s*\n\s*UPDATE public\.acordos[\s\S]*encerramento_motivo = 'sem_lugares_vivos'/,
    );
    expect(next).toContain("encerramento_motivo = 'sem_lugares_vivos'");
    expect(next).toMatch(
      /_maybe_fechar_acordo_sem_lugares_vivos\(p_acordo_id\);\s*\n\s*IF v_ultimo_passageiro_saiu THEN[\s\S]*encerramento_motivo = 'sem_lugares_vivos'/,
    );
    expect(next).toMatch(/Último passageiro: supressão via tabela interna \+ txid/);
    expect(next).toMatch(/rescisao_modo IS NULL/);
    expect(next).toMatch(
      /rescisao_modo IS NULL[\s\S]*OR[\s\S]*lower\(rescisao_modo\) = 'consensual'[\s\S]*rescisao_confirmada_em IS NULL/,
    );
    expect(next).not.toMatch(
      /encerramento_motivo = 'sem_lugares_vivos'[\s\S]*AND rescisao_modo IS NULL\s*AND encerramento_motivo IS NULL;/,
    );
  });

  it('backfill is_test: CLEAR sem saiu + SET consensual pendente', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_BACKFILL))).toBe(true);
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_BACKFILL), 'utf8');
    expect(sql).toMatch(/o\.is_test = true/);
    expect(sql).toMatch(/encerramento_motivo = NULL/);
    expect(sql).toMatch(/encerramento_motivo = 'sem_lugares_vivos'/);
    expect(sql).toMatch(/rescisao_confirmada_em IS NULL/);
  });

  it('count_lugares_vivos_acordo: só passageiro vivo (sem motorista)', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_COUNT_LUGARES_VIVOS))).toBe(true);
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_COUNT_LUGARES_VIVOS), 'utf8');
    expect(sql).toMatch(/lower\(ap\.estado\) IN \('activo', 'reservado'\)/);
    expect(sql).not.toMatch(/v_is_driver := v_uid = v_acordo\.driver_id/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.count_lugares_vivos_acordo\(uuid\) TO authenticated;/);
  });

  it('GRANT/REVOKE leave_passenger alinhados (authenticated, sem anon)', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_LEAVE), 'utf8');
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) TO authenticated;/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.leave_passenger\(uuid, uuid, uuid\) FROM anon;/,
    );
  });

  it('AgreementService listagens usam * (encerramento_motivo legível via TABLE SELECT)', () => {
    const src = readFileSync(join(ROOT, 'AgreementService.js'), 'utf8');
    expect(src).toMatch(/TABLE SELECT authenticated/i);
    expect(src).not.toMatch(/ACORDO_COLUMN_ENCERRAMENTO_MOTIVO/);
    const driverBlock = src.match(
      /export async function getAgreementsForDriver[\s\S]*?^}/m,
    )?.[0] || '';
    expect(driverBlock).toMatch(/\.select\([\s\S]*\*[\s\S]*acordos_passageiros/);
  });
});
