/**
 * Contrato encerramento_motivo — migração, privilégios helper, select MyAgreements.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACORDO_COLUMN_ENCERRAMENTO_MOTIVO } from './AgreementService.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION_FILE = '20261009240000_acordo_encerramento_motivo.sql';
const P0_MIGRATION = '20261009180000_p0_acordo_pagamento_estados.sql';

describe('Acordo encerramento_motivo — contrato', () => {
  it('migração adiciona coluna, CHECK e actualiza _maybe_fechar_acordo_sem_lugares_vivos', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION_FILE))).toBe(true);
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(/encerramento_motivo/);
    expect(sql).toMatch(/sem_lugares_vivos/);
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\._maybe_fechar_acordo_sem_lugares_vivos/,
    );
    expect(sql).toMatch(/ofertas_capacidade.*is_test/s);
  });

  it('_maybe_fechar mantém REVOKE PUBLIC/anon/authenticated e GRANT service_role', () => {
    const sql = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\._maybe_fechar_acordo_sem_lugares_vivos\(uuid\) FROM PUBLIC/,
    );
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\._maybe_fechar_acordo_sem_lugares_vivos\(uuid\) FROM anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\._maybe_fechar_acordo_sem_lugares_vivos\(uuid\) TO service_role/,
    );
  });

  it('corpo base alinhado à migração P0 (prod md5 69166936…)', () => {
    const p0 = readFileSync(join(MIGRATIONS, P0_MIGRATION), 'utf8');
    const mig = readFileSync(join(MIGRATIONS, MIGRATION_FILE), 'utf8');
    const extract = (raw) => {
      const m = raw.match(
        /CREATE OR REPLACE FUNCTION public\._maybe_fechar_acordo_sem_lugares_vivos[\s\S]*?\$function\$;/,
      );
      return m?.[0] || '';
    };
    const base = extract(p0);
    const next = extract(mig);
    expect(base).toMatch(/v_vivos = 0/);
    expect(next).toMatch(/encerramento_motivo = 'sem_lugares_vivos'/);
    expect(next).toMatch(/lower\(v_acordo\.estado\) NOT IN \('activo', 'cancelamento_pendente'\)/);
  });

  it('AgreementService expõe coluna encerramento_motivo nas listagens MyAgreements', () => {
    expect(ACORDO_COLUMN_ENCERRAMENTO_MOTIVO).toBe('encerramento_motivo');
    const src = readFileSync(join(ROOT, 'AgreementService.js'), 'utf8');
    expect(src).toMatch(
      /getAgreementsForDriver[\s\S]{0,1200}ACORDO_COLUMN_ENCERRAMENTO_MOTIVO/,
    );
    expect(src).toMatch(
      /getAgreementsForPassenger[\s\S]{0,1200}ACORDO_COLUMN_ENCERRAMENTO_MOTIVO/,
    );
  });

  it('documenta leitura TABLE SELECT authenticated (coluna nova legível via *)', () => {
    const src = readFileSync(join(ROOT, 'AgreementService.js'), 'utf8');
    expect(src).toMatch(/TABLE.*SELECT.*acordos|authenticated.*SELECT.*acordos/i);
  });
});
