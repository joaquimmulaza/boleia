/**
 * Security PR B — contrato migração + edge send-push
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(ROOT, '../../supabase/migrations');
const MIGRATION = '20261010100000_sec_pr_b_push_webhook_grants_create_proposal.sql';
const SEND_PUSH = join(ROOT, '../../supabase/functions/send-push/index.ts');

function readMigration() {
  const path = join(MIGRATIONS, MIGRATION);
  if (!existsSync(path)) {
    throw new Error(`Migração em falta: ${MIGRATION}`);
  }
  return readFileSync(path, 'utf8');
}

describe('Security PR B — contrato', () => {
  it('migração existe', () => {
    expect(existsSync(join(MIGRATIONS, MIGRATION))).toBe(true);
  });

  it('revoga anon/PUBLIC em push_subscriptions mantendo authenticated', () => {
    const sql = readMigration();
    expect(sql).toMatch(/REVOKE ALL ON TABLE public\.push_subscriptions FROM anon, PUBLIC/);
    expect(sql).toMatch(/GRANT INSERT \(user_id, subscription\) ON TABLE public\.push_subscriptions TO authenticated/);
    expect(sql).toMatch(/GRANT DELETE ON TABLE public\.push_subscriptions TO authenticated/);
    expect(sql).toMatch(/GRANT SELECT ON TABLE public\.push_subscriptions TO authenticated/);
  });

  it('create_proposal valida grupo da procura e N vs membros activos', () => {
    const sql = readMigration();
    expect(sql).toMatch(/Grupo não pertence a esta procura/);
    expect(sql).toMatch(/excede os membros activos do grupo/);
    expect(sql).toMatch(/estado = 'activo'/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.create_proposal\(/);
  });

  it('trigger push lê vault e envia x-boleia-push-secret', () => {
    const sql = readMigration();
    expect(sql).toMatch(/vault\.decrypted_secrets/);
    expect(sql).toMatch(/push_webhook_secret/);
    expect(sql).toMatch(/x-boleia-push-secret/);
    expect(sql).toMatch(/handle_new_notification_push/);
  });

  it('send-push exige secret em constant-time', () => {
    const src = readFileSync(SEND_PUSH, 'utf8');
    expect(src).toMatch(/x-boleia-push-secret/i);
    expect(src).toMatch(/PUSH_WEBHOOK_SECRET/);
    expect(src).toMatch(/401/);
    expect(src).toMatch(/constantTimeEqual|timingSafeEqual|timing-safe/i);
  });
});
