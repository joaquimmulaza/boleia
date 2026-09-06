-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906114018 s22_acordos_rescisao_columns_and_estado_check
-- Do not rename; Supabase Preview CI requires exact version match.

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS rescisao_modo text,
  ADD COLUMN IF NOT EXISTS rescisao_solicitada_por uuid,
  ADD COLUMN IF NOT EXISTS rescisao_justificativa text,
  ADD COLUMN IF NOT EXISTS rescisao_effective_on date,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'acordos_rescisao_solicitada_por_fkey'
      AND conrelid = 'public.acordos'::regclass
  ) THEN
    ALTER TABLE public.acordos
      ADD CONSTRAINT acordos_rescisao_solicitada_por_fkey
      FOREIGN KEY (rescisao_solicitada_por)
      REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END;
$$;

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_rescisao_modo_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_rescisao_modo_check
  CHECK (
    rescisao_modo IS NULL
    OR lower(rescisao_modo) = ANY (
      ARRAY['aviso_previo'::text, 'consensual'::text, 'justa_causa'::text]
    )
  );

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_estado_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_estado_check
  CHECK (
    estado = ANY (
      ARRAY[
        'activo'::text,
        'suspenso'::text,
        'cancelamento_pendente'::text,
        'cancelado'::text,
        'cancelado_justificado'::text,
        'expirado'::text
      ]
    )
  );

CREATE INDEX IF NOT EXISTS idx_acordos_rescisao_pendente
  ON public.acordos (rescisao_effective_on)
  WHERE estado = 'cancelamento_pendente';
