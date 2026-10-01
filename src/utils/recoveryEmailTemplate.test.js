import { describe, it, expect } from 'vitest';
import {
  RECOVERY_EMAIL_SUBJECT,
  readRecoveryEmailHtml,
  buildRecoveryMailerPayload,
} from '../../supabase/templates/recoveryMailer.js';

describe('template email de recuperação (PT-PT)', () => {
  it('assunto em português, sem copy default em inglês', () => {
    expect(RECOVERY_EMAIL_SUBJECT).toBe('Redefinir a sua palavra-passe');
    expect(RECOVERY_EMAIL_SUBJECT).not.toMatch(/reset/i);
  });

  it('HTML em português com o link de confirmação do GoTrue', () => {
    const html = readRecoveryEmailHtml();
    expect(html).toContain('Redefinir a palavra-passe');
    expect(html).toContain('Boleia Certa');
    expect(html).toContain('{{ .ConfirmationURL }}');
    expect(html).toContain('Redefinir palavra-passe');
    expect(html).not.toMatch(/Reset Password/);
    expect(html).not.toMatch(/Follow this link to reset/);
    expect(html).not.toMatch(/\bsenha\b/i);
  });

  it('payload de Management API só toca nos campos de recovery', () => {
    const payload = buildRecoveryMailerPayload();
    expect(Object.keys(payload).sort()).toEqual([
      'mailer_subjects_recovery',
      'mailer_templates_recovery_content',
    ]);
    expect(payload.mailer_subjects_recovery).toBe(RECOVERY_EMAIL_SUBJECT);
    expect(payload.mailer_templates_recovery_content).toBe(readRecoveryEmailHtml());
  });
});
