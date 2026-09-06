-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905154813 procuras_dias_semana
-- Do not rename; Supabase Preview CI requires exact version match.

-- R1: dias_semana em procuras (mesmo tipo que ofertas_capacidade.dias_semana)
ALTER TABLE public.procuras
  ADD COLUMN IF NOT EXISTS dias_semana integer[] NOT NULL DEFAULT ARRAY[1, 2, 3, 4, 5];

COMMENT ON COLUMN public.procuras.dias_semana IS
  'Dias da semana 1=Seg … 7=Dom. Matching exige intersecção real com a oferta; vazio não é compatível.';
