import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { ANULACAO_MOTIVOS_TODOS } from './anulacaoMotivos.js';

/** Só PERFORM com literal string — ignora corpos de função (ex. IN ('comprovativo_enviado')). */
const MOTIVO_LITERAL_RE =
  /PERFORM\s+public\._(?:expirar_lugar_reservado_sem_divida|anular_pagamento_sem_divida)\s*\([\s\S]*?,\s*'([^']+)'\s*\)/g;

/**
 * @param {string} sql
 * @returns {Set<string>}
 */
function extractMotivoLiteraisFromSql(sql) {
  const found = new Set();
  for (const match of sql.matchAll(MOTIVO_LITERAL_RE)) {
    found.add(match[1]);
  }
  return found;
}

describe('anulacaoMotivos — contrato SQL ↔ constantes', () => {
  it('inclui todos os literais de motivo nas migrações Supabase', () => {
    const migrationsDir = join(process.cwd(), 'supabase/migrations');
    const sqlFiles = readdirSync(migrationsDir).filter((name) => name.endsWith('.sql'));
    const literaisSql = new Set();

    for (const file of sqlFiles) {
      const content = readFileSync(join(migrationsDir, file), 'utf8');
      for (const literal of extractMotivoLiteraisFromSql(content)) {
        literaisSql.add(literal);
      }
    }

    expect(literaisSql.size).toBeGreaterThan(0);
    for (const literal of literaisSql) {
      expect(ANULACAO_MOTIVOS_TODOS, `motivo SQL em falta em anulacaoMotivos.js: ${literal}`).toContain(
        literal,
      );
    }
  });
});
