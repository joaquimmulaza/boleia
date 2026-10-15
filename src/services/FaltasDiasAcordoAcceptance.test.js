import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('FaltasDiasAcordo — migração SQL', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20261015143000_faltas_dias_acordo.sql'),
    'utf8',
  );

  it('log_falta rejeita dia fora do acordo com BCF03', () => {
    expect(sql).toMatch(/ERRCODE = 'BCF03'/);
    expect(sql).toMatch(/Esta data não é dia de viagem neste acordo/);
  });

  it('handle_falta_desconto zera desconto fora dos dias de viagem', () => {
    expect(sql).toMatch(/_is_dia_viagem_acordo\(NEW\.data_falta/);
    expect(sql).toMatch(/NEW\.desconto_kz := 0/);
  });

  it('handle_falta_desconto usa count_dias_viagem_mes do mês da falta (não acordos.dias_uteis_mes)', () => {
    expect(sql).toMatch(/count_dias_viagem_mes\(/);
    expect(sql).toMatch(/Africa\/Luanda/);
    expect(sql).not.toMatch(/a\.dias_uteis_mes/);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.accept_proposal/);
  });

  it('fallback Seg–Sex documentado em _dias_semana_acordo_efetivos', () => {
    expect(sql).toMatch(/ARRAY\[1, 2, 3, 4, 5\]/);
  });
});
