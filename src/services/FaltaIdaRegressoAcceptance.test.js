/**
 * PACOTE falta-ida-regresso — política meia quota (decisão 2026-09-07).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeFaltaDesconto } from '../utils/faltaDesconto.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIG = join(
  ROOT,
  '../../supabase/migrations/20260906230154_pacote_eng11_assiduidade_faltadesconto_gate.sql',
);

describe('falta-ida-regresso — meia quota canónica', () => {
  it('F1 — trigger SQL: ambas = dia; ida/regresso = /2', () => {
    const sql = readFileSync(MIG, 'utf8');
    expect(sql).toMatch(/handle_falta_desconto/);
    expect(sql).toMatch(/NEW\.viagem = 'ambas'/);
    expect(sql).toMatch(/\/ 2\.0/);
  });

  it('F2 — util espelha SQL (30000/22)', () => {
    expect(computeFaltaDesconto(30000, 22, 'ambas')).toBe(1363.64);
    expect(computeFaltaDesconto(30000, 22, 'ida')).toBe(681.82);
  });

  it('minuta Spec documenta 50%/100%', () => {
    const minuta = readFileSync(
      join(ROOT, '../../.specs/quick/pacote-falta-ida-regresso/clausula-9-minuta.md'),
      'utf8',
    );
    expect(minuta).toMatch(/metade|50%/i);
    expect(minuta).toMatch(/100%|integral/i);
  });
});
