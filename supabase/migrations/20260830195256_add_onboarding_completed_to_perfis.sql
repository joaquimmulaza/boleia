-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260830195256 add_onboarding_completed_to_perfis
-- Do not rename; Supabase Preview CI requires exact version match.

ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
