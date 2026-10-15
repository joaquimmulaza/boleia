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

  it('início activo PM3: greatest(created_at, 1.º mes pago em_custodia|liquidado)', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/GREATEST\(v_created, v_primeiro_mes_pago\)/);
    expect(sql).not.toMatch(/validado_em/);
    expect(sql).toMatch(/em_custodia.*liquidado/s);
  });

  it('B1: _desconto_faltas_pagamento INVOKER (sem DEFINER/search_path) + REVOKE authenticated', () => {
    const sql = readFileSync(MIG, 'utf8');
    const descontoBlock = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public._desconto_faltas_pagamento'));
    const nextFn = descontoBlock.indexOf('REVOKE ALL ON FUNCTION public.trg_acordos_passageiros');
    const fnBody = nextFn > 0 ? descontoBlock.slice(0, nextFn) : descontoBlock;
    expect(fnBody).not.toMatch(/SECURITY DEFINER/);
    expect(fnBody).not.toMatch(/SET search_path/);
    expect(fnBody).toMatch(/LANGUAGE sql\s*\nSTABLE/);
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\._desconto_faltas_pagamento\(uuid, uuid, date\) FROM anon, authenticated/,
    );
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\._desconto_faltas_pagamento\(uuid, uuid, date\) TO service_role/,
    );
  });

  it('REVOKE EXECUTE dos helpers _passageiro_lugar_* a authenticated', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\._passageiro_lugar_inicio_activo_em\(uuid\) FROM anon, authenticated/,
    );
  });

  it('prova PG cobre casos 1–8, Fixture C e vigência', () => {
    const proof = readFileSync(PG_PROOF, 'utf8');
    expect(proof).toMatch(/FAIL R4 \(1\) activo/);
    expect(proof).toMatch(/FAIL R4 \(5\) saiu sem timestamp/);
    expect(proof).toMatch(/FAIL R4 \(6\) JC dia saída/);
    expect(proof).toMatch(/FAIL R4 \(8\) 1:1 fim via acordos\.cancelado_em/);
    expect(proof).toMatch(/FAIL B1: authenticated não devia executar _desconto_faltas_pagamento/);
    expect(proof).toMatch(/get_desconto_faltas_preview\(v_pg_out\)/);
    expect(proof).toMatch(/FAIL Fixture C pax5/);
    expect(proof).toMatch(/created 5\/10 falta 3\/10/);
  });
});
