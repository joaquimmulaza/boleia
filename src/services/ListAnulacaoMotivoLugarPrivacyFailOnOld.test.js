/**
 * Proxy FAIL-on-old quando psql não está disponível.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIG = join(ROOT, '../../supabase/migrations/20261009191000_list_anulacao_motivo_lugar_acordo.sql');
const MIG_REL = 'supabase/migrations/20261009191000_list_anulacao_motivo_lugar_acordo.sql';

describe('FAIL-on-old — RPC list_anulacao_motivo_lugar @ 4e587db', () => {
  it('4e587db expunha pagamento_estado de outros passageiros (prova PG falharia)', () => {
    const oldSql = execSync(`git show 4e587db:${MIG_REL}`, { encoding: 'utf8' });
    expect(oldSql).toMatch(/pg\.estado AS pagamento_estado/);
    expect(oldSql).not.toMatch(/OR ap\.passenger_id = v_uid/);
  });
});

describe('FAIL-on-old — RPC list_anulacao_motivo_lugar @ 3052d44', () => {
  it('3052d44 devolvia todas as linhas do acordo via EXISTS (prova PG falharia)', () => {
    const oldSql = execSync(`git show 3052d44:${MIG_REL}`, { encoding: 'utf8' });
    expect(oldSql).toMatch(/EXISTS\s*\(\s*\n\s*SELECT 1 FROM public\.acordos_passageiros ap_self/s);
    expect(oldSql).not.toMatch(/OR ap\.passenger_id = v_uid\s*\n\s*\)/s);
  });

  it('versão actual: passageiro só ap.passenger_id = v_uid', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/SET search_path = public, pg_temp/);
    expect(sql).toMatch(/OR ap\.passenger_id = v_uid/);
    expect(sql).not.toMatch(/ap_self/);
  });
});
