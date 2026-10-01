#!/usr/bin/env node
/**
 * Aplica o template de recuperação PT-PT no projecto alojado.
 * Não faz `supabase config push` (o config.toml é localhost).
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/apply-auth-email-templates.mjs
 *
 * Token: https://supabase.com/dashboard/account/tokens
 */
import { buildRecoveryMailerPayload } from '../supabase/templates/recoveryMailer.js';

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'fdclrbcgytnuqcrpsevw';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!TOKEN) {
  console.error('Falta SUPABASE_ACCESS_TOKEN. Crie um PAT em https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const payload = buildRecoveryMailerPayload();
const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`Falha ${response.status}: ${body}`);
  process.exit(1);
}

const data = await response.json();
console.log('Template recovery aplicado:', {
  subject: data.mailer_subjects_recovery,
  htmlChars: String(data.mailer_templates_recovery_content || '').length,
});
