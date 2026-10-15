/**
 * Regra 4 — falta Motorista só desconta se o lugar estava activo na data_falta.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIG = join(
  ROOT,
  '../../supabase/migrations/20261015130000_faltas_regra5_motorista_lugar_activo.sql',
);
const PG_PROOF = join(ROOT, '../../supabase/tests/faltas_regra5_pg_proof.sql');

describe('Regra 4 faltas — motorista × lugar activo', () => {
  it('migração filtra motorista com _passageiro_lugar_activo_em_data', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/_passageiro_lugar_activo_em_data/);
    expect(sql).toMatch(/lower\(f\.tipo\) = 'motorista'/);
    expect(sql).toMatch(/f\.data_falta/);
    expect(sql).toMatch(
      /lower\(f\.tipo\) = 'motorista'\s*\n\s*AND public\._passageiro_lugar_activo_em_data/,
    );
  });

  it('persiste saiu_em na saída normal do lugar', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/saiu_em/);
    expect(sql).toMatch(/trg_acordos_passageiros_set_saiu_em/);
    expect(sql).toMatch(/lugar_rescisao_em/);
  });

  it('prova PG cobre 4 casos de vigência (activo, saiu antes/depois, entrou depois)', () => {
    const proof = readFileSync(PG_PROOF, 'utf8');
    expect(proof).toMatch(/FAIL R4 activo: esperava 500/);
    expect(proof).toMatch(/FAIL R4 saiu antes: esperava 0/);
    expect(proof).toMatch(/FAIL R4 entrou depois: esperava 0/);
    expect(proof).toMatch(/FAIL R4 saiu depois: esperava 500/);
    expect(proof).toMatch(/Regra 4 motorista × lugar activo \(4 casos\)/);
  });
});
