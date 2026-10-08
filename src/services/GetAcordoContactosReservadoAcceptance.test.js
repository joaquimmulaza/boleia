/**
 * get_acordo_contactos — passageiro reservado vê detalhe bloqueado (sem 400).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIG = '20261008160000_get_acordo_contactos_reservado.sql';

/** @returns {string} */
function readMig() {
  return readFileSync(join(MIGRATIONS, MIG), 'utf8');
}

/** Extrai o corpo da função get_acordo_contactos da migração. */
function extractFunctionBody(sql) {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.get_acordo_contactos');
  const end = sql.indexOf('$function$;', start);
  return sql.slice(start, end + '$function$;'.length);
}

describe('get_acordo_contactos — passageiro reservado', () => {
  it('G1 — v_is_passenger aceita activo e reservado', () => {
    const sql = readMig();
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.get_acordo_contactos/);
    expect(sql).toMatch(
      /lower\(ap\.estado\) IN \('activo',\s*'reservado'\)[\s\S]*INTO v_is_passenger/,
    );
  });

  it('G2 — lista de passageiros ao motorista continua só activo', () => {
    const sql = readMig();
    const body = extractFunctionBody(sql);
    const loopMatch = body.match(
      /FOR v_row IN[\s\S]*?WHERE ap\.acordo_id = p_acordo_id[\s\S]*?LOOP/,
    );
    expect(loopMatch).toBeTruthy();
    expect(loopMatch[0]).toMatch(/lower\(ap\.estado\) = 'activo'/);
    expect(loopMatch[0]).not.toMatch(/'reservado'/);
  });

  it('G3 — passageiro bloqueado mantém motivo de pagamento e não expõe telefone', () => {
    const sql = readMig();
    expect(sql).toMatch(
      /WHEN v_is_passenger AND v_bloqueado THEN 'Confirma o pagamento e aguarda validação para ver contactos\.'/,
    );
    expect(sql).toMatch(
      /WHEN v_is_passenger AND NOT v_bloqueado THEN p\.telefone/,
    );
    expect(sql).toMatch(/v_bloqueado boolean := true/);
    expect(sql).toMatch(
      /lower\(v_my_pagamento\.estado\) IN \('em_custodia',\s*'liquidado'\)/,
    );
  });

  it('G4 — assinatura, SECURITY DEFINER e grants inalterados (sem GRANT na migração)', () => {
    const sql = readMig();
    expect(sql).toMatch(
      /CREATE OR REPLACE FUNCTION public\.get_acordo_contactos\(p_acordo_id uuid\)/,
    );
    expect(sql).toMatch(/SECURITY DEFINER/);
    expect(sql).not.toMatch(/GRANT EXECUTE/);
    expect(sql).not.toMatch(/REVOKE EXECUTE/);
  });
});
