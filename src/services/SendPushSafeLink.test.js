/**
 * B2 — send-push não deve propagar link externo no payload push.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

describe('send-push — safe notification URL (B2)', () => {
  it('edge function usa catálogo partilhado para título e url', () => {
    const src = readFileSync(
      join(ROOT, '../../supabase/functions/send-push/index.ts'),
      'utf8',
    );
    expect(src).toContain('resolveNotificationPushDestination');
    expect(src).toContain('resolveNotificationTitle');
    expect(src).toContain('../_shared/notificationCatalog.js');
    expect(src).not.toMatch(/url:\s*link\s*\|\|/);
    expect(src).not.toContain('Nova Notificação');
  });

  it('fallback de título no catálogo é Boleia Certa', () => {
    const catalog = readFileSync(
      join(ROOT, '../../supabase/functions/_shared/notificationCatalog.js'),
      'utf8',
    );
    expect(catalog).toContain("FALLBACK_NOTIFICATION_TITLE = 'Boleia Certa'");
    expect(catalog).not.toContain('Nova Notificação');
  });
});
