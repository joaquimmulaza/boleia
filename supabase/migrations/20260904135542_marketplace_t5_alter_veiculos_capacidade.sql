-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904135542 marketplace_t5_alter_veiculos_capacidade
-- Do not rename; Supabase Preview CI requires exact version match.

-- T5: capacidade_total + vagas_passageiros; remover ambiguidade lugares_disponiveis
-- UNIQUE id_motorista preservado

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS capacidade_total integer,
  ADD COLUMN IF NOT EXISTS vagas_passageiros integer;

-- Migrar dados existentes (0 rows hoje; fórmula: lugares_disponiveis = vagas pax)
UPDATE public.veiculos
SET
  vagas_passageiros = COALESCE(vagas_passageiros, lugares_disponiveis),
  capacidade_total = COALESCE(capacidade_total, lugares_disponiveis + 1)
WHERE capacidade_total IS NULL OR vagas_passageiros IS NULL;

ALTER TABLE public.veiculos
  ALTER COLUMN capacidade_total SET NOT NULL,
  ALTER COLUMN vagas_passageiros SET NOT NULL;

ALTER TABLE public.veiculos
  DROP CONSTRAINT IF EXISTS veiculos_lugares_disponiveis_check;

ALTER TABLE public.veiculos
  DROP COLUMN IF EXISTS lugares_disponiveis;

ALTER TABLE public.veiculos
  DROP CONSTRAINT IF EXISTS veiculos_capacidade_total_check,
  DROP CONSTRAINT IF EXISTS veiculos_vagas_passageiros_check,
  DROP CONSTRAINT IF EXISTS veiculos_capacidade_vagas_consistency;

ALTER TABLE public.veiculos
  ADD CONSTRAINT veiculos_capacidade_total_check CHECK (capacidade_total >= 2),
  ADD CONSTRAINT veiculos_vagas_passageiros_check CHECK (vagas_passageiros >= 1),
  ADD CONSTRAINT veiculos_capacidade_vagas_consistency CHECK (vagas_passageiros = capacidade_total - 1);

-- Garantir UNIQUE id_motorista (já existe veiculos_id_motorista_key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'veiculos_id_motorista_key'
      AND conrelid = 'public.veiculos'::regclass
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'veiculos_id_motorista_key'
  ) THEN
    ALTER TABLE public.veiculos ADD CONSTRAINT veiculos_id_motorista_key UNIQUE (id_motorista);
  END IF;
END $$;
