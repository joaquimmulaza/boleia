/**
 * Regra 5 faltas — contrato SQL (prazo passageiro + desconto_mes_referencia).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIG = join(ROOT, '../../supabase/migrations/20261015100000_faltas_regra5_desconto_mes_prazo.sql');

describe('Regra 5 faltas — migração SQL', () => {
  it('define prazo passageiro 22:00 Luanda e SQLSTATE BCF02 único', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/Africa\/Luanda/);
    expect(sql).toMatch(/22:00:00/);
    expect(sql).not.toMatch(/BCF01/);
    expect(sql).toMatch(/ERRCODE = 'BCF02'/);
    expect(sql).toMatch(/22:00 do dia anterior/);
    expect(sql).toMatch(/desconto_mes_referencia/);
    expect(sql).toMatch(/v_passenger_id = v_uid/);
  });

  it('_desconto_faltas_pagamento usa desconto_mes_referencia', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/desconto_mes_referencia/);
    expect(sql).toMatch(/_desconto_faltas_pagamento/);
  });

  it('handle_falta_desconto resolve mês de liquidação', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/_resolve_desconto_mes_falta/);
    expect(sql).toMatch(/handle_falta_desconto/);
  });
});
