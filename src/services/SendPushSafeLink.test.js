/**
 * B2 — send-push não deve propagar link externo no payload push.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

describe('send-push — safe notification URL (B2)', () => {
  it('edge function sanitiza link via _shared/safeNotificationLink', () => {
    const src = readFileSync(
      join(ROOT, '../../supabase/functions/send-push/index.ts'),
      'utf8',
    );
    expect(src).toContain('resolvePushDataUrl');
    expect(src).toContain('../_shared/safeNotificationLink.ts');
    expect(src).not.toMatch(/url:\s*link\s*\|\|/);
  });
});
