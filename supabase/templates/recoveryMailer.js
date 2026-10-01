import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const templatesDir = dirname(fileURLToPath(import.meta.url));

export const RECOVERY_EMAIL_SUBJECT = 'Redefinir a sua palavra-passe';

/**
 * @returns {string}
 */
export function readRecoveryEmailHtml() {
  return readFileSync(join(templatesDir, 'recovery.html'), 'utf8');
}

/**
 * Payload cirúrgico para PATCH /v1/projects/{ref}/config/auth
 * (não envia site_url nem o resto do config.toml local).
 * @returns {{ mailer_subjects_recovery: string, mailer_templates_recovery_content: string }}
 */
export function buildRecoveryMailerPayload() {
  return {
    mailer_subjects_recovery: RECOVERY_EMAIL_SUBJECT,
    mailer_templates_recovery_content: readRecoveryEmailHtml(),
  };
}
