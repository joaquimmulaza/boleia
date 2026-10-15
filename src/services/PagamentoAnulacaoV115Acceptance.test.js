import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname;
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION = '20261012222000_pagamento_anulacao_v1_15.sql';
const ENG16 = '20260907151936_pacote_eng16_domain_notifications.sql';
const P0 = '20261009180000_p0_acordo_pagamento_estados.sql';

/** @param {string} filename */
function readMigration(filename) {
  return readFileSync(join(MIGRATIONS, filename), 'utf8');
}

describe('Pagamento anulação — card v1.15', () => {
  it('v1.15(a): INSERT anulado não dispara aviso mensal (main ENG#16 falha aqui)', () => {
    const eng16 = readMigration(ENG16);
    const v15 = readMigration(MIGRATION);
    expect(eng16).toMatch(
      /PERFORM public\.notify_domain_event\(\s*\n\s*NEW\.passenger_id,\s*\n\s*'Pagamento mensal disponível — envia o comprovativo em Acordos.'/,
    );
    expect(eng16).not.toMatch(/lower\(COALESCE\(NEW\.estado, ''\)\) <> 'anulado'/);
    expect(v15).toMatch(/lower\(COALESCE\(NEW\.estado, ''\)\) <> 'anulado'/);
  });

  it('v1.15(b): anulação purga aviso já enviado (P0 _anular falha aqui)', () => {
    const p0 = readMigration(P0);
    const v15 = readMigration(MIGRATION);
    expect(p0).toMatch(/CREATE OR REPLACE FUNCTION public\._anular_pagamento_sem_divida/);
    expect(p0).not.toMatch(/_purge_pagamento_mensal_disponivel_notif/);
    expect(v15).toMatch(/PERFORM public\._purge_pagamento_mensal_disponivel_notif/);
    expect(v15).toMatch(/metadata->>'pagamento_id' = p_pagamento_id::text/);
    expect(v15).toMatch(
      /lower\(NEW\.estado\) = 'anulado'\s*\n\s*AND lower\(COALESCE\(OLD\.estado, ''\)\) <> 'anulado'/,
    );
  });

  it('prova PG dedicada existe', () => {
    expect(
      existsSync(join(ROOT, '../../supabase/tests/pagamento_anulacao_v1_15_pg_proof.sql')),
    ).toBe(true);
    expect(existsSync(join(ROOT, '../../scripts/run-pagamento-anulacao-v1-15-pg-proof.sh'))).toBe(
      true,
    );
  });
});
