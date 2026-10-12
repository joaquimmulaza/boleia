import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FIX = '20261012170000_expiry_close_sem_lugares_vivos.sql';
const MIGRATION_LEAVE_PROD = '20261010000000_encerramento_motivo_leave_passenger.sql';
const MIGRATION_EXPIRY_PROD = '20261009180000_p0_acordo_pagamento_estados.sql';

/** @param {string} raw */
function extractApplyDueReservaExpiryBody(raw) {
  const m = raw.match(
    /CREATE OR REPLACE FUNCTION public\.apply_due_reserva_expiry[\s\S]*?\$function\$;/,
  );
  return m?.[0] || '';
}

/** @param {string} raw */
function extractLeavePassengerBody(raw) {
  const m = raw.match(
    /CREATE OR REPLACE FUNCTION public\.leave_passenger[\s\S]*?\$function\$;/,
  );
  return m?.[0] || '';
}

describe('expiry close sem_lugares_vivos — migração 20261012170000', () => {
  it('migração de fix existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FIX))).toBe(true);
  });

  it('apply_due_reserva_expiry: card v1.8 motorista e sem notif passageiro no último lugar', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FIX), 'utf8');
    expect(sql).toMatch(/'card',\s*'v1\.8'/);
    expect(sql).toMatch(/last_reservation_expired/);
    const body = extractApplyDueReservaExpiryBody(sql);
    expect(body).toMatch(/_p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao/);
    expect(body).toMatch(/IF NOT v_fechou THEN/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\._p0_encerrar_acordo_sem_lugares_vivos_pos_expiracao[\s\S]*encerramento_motivo = 'sem_lugares_vivos'/,
    );
  });

  it('leave_passenger: card v1.10 ao motorista remover não-último', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FIX), 'utf8');
    const body = extractLeavePassengerBody(sql);
    expect(body).toMatch(/'card',\s*'v1\.10'/);
    expect(body).toMatch(/Já não fazes parte deste acordo/);
    expect(body).toMatch(/O motorista retirou-te do acordo/);
    expect(body).toMatch(/driver_removed_passenger_partial/);
    expect(body).toMatch(/origin_name/);
  });

  it('reparação is_test exclui ac722c73', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FIX), 'utf8');
    expect(sql).toMatch(/ac722c73-/i);
    expect(sql).toMatch(/is_test = true/);
  });

  it('FAIL-on-old: apply_due_reserva_expiry prod sempre notifica passageiro após expirar', () => {
    const body = extractApplyDueReservaExpiryBody(
      readFileSync(join(MIGRATIONS, MIGRATION_EXPIRY_PROD), 'utf8'),
    );
    expect(body).toMatch(
      /_expirar_lugar_reservado_sem_divida[\s\S]{0,280}A tua reserva expirou por falta de pagamento/,
    );
    expect(body).not.toMatch(/'card',\s*'v1\.8'/);
  });

  it('FAIL-on-old: leave_passenger prod sem v1.10 motorista remove parcial', () => {
    const body = extractLeavePassengerBody(
      readFileSync(join(MIGRATIONS, MIGRATION_LEAVE_PROD), 'utf8'),
    );
    expect(body).not.toMatch(/v1\.10/);
    expect(body).not.toMatch(/driver_removed_passenger_partial/);
  });
});

describe('expiry close sem_lugares_vivos — prova PG', () => {
  it('script SQL e runner existem', () => {
    expect(
      existsSync(
        join(ROOT, '../../supabase/tests/expiry_close_sem_lugares_vivos_pg_proof.sql'),
      ),
    ).toBe(true);
    expect(
      existsSync(join(ROOT, '../../scripts/run-expiry-close-sem-lugares-vivos-pg-proof.sh')),
    ).toBe(true);
  });
});
