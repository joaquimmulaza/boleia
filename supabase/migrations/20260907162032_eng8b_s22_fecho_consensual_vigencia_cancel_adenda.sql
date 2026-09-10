-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260907162032 eng8b_s22_fecho_consensual_vigencia_cancel_adenda
-- Do not rename; Supabase Preview CI requires exact version match.

-- ENG#8b: rescisão consensual com vigência (imediato|fim_ciclo) + cancel_agreement_adenda

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS rescisao_vigencia text;

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_rescisao_vigencia_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_rescisao_vigencia_check
  CHECK (
    rescisao_vigencia IS NULL
    OR lower(rescisao_vigencia) = ANY (ARRAY['imediato'::text, 'fim_ciclo'::text])
  );
