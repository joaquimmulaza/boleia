/**
 * Proxy FAIL-on-old para ambientes sem psql: a RPC em 4e587db devolvia pg.estado a todos os passageiros.
 * A prova SQL em supabase/tests/list_anulacao_motivo_lugar_privacy_pg_proof.sql falha com a mesma versão.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIG = join(ROOT, '../../supabase/migrations/20261009191000_list_anulacao_motivo_lugar_acordo.sql');

describe('FAIL-on-old — RPC list_anulacao_motivo_lugar @ 4e587db', () => {
  it('4e587db expunha pagamento_estado de outros passageiros (prova PG falharia)', () => {
    const oldSql = execSync(
      'git show 4e587db:supabase/migrations/20261009191000_list_anulacao_motivo_lugar_acordo.sql',
      { encoding: 'utf8' },
    );
    expect(oldSql).toMatch(/pg\.estado AS pagamento_estado/);
    expect(oldSql).not.toMatch(/WHEN ap\.passenger_id = v_uid THEN pg\.estado/);
  });

  it('versão actual aplica mascaramento CASE', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
    expect(sql).toMatch(/WHEN ap\.passenger_id = v_uid THEN pg\.estado/);
    expect(sql).toMatch(/WHEN pg\.estado = 'anulado' THEN pg\.anulacao_motivo/);
  });
});
