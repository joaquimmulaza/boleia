-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904213324 t31_grupos_n_maximo_pedidos_entrada
-- Do not rename; Supabase Preview CI requires exact version match.

-- T31: capacidade pretendida + pedidos de entrada (estado pendente/rejeitado)
ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS n_maximo integer NOT NULL DEFAULT 4;

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_n_maximo_check;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_n_maximo_check CHECK (n_maximo BETWEEN 2 AND 8);

ALTER TABLE public.membros_grupo
  DROP CONSTRAINT IF EXISTS membros_grupo_estado_check;

ALTER TABLE public.membros_grupo
  ADD CONSTRAINT membros_grupo_estado_check
  CHECK (estado = ANY (ARRAY['activo'::text, 'saiu'::text, 'pendente'::text, 'rejeitado'::text]));

COMMENT ON COLUMN public.grupos.n_maximo IS 'Capacidade pretendida pelo criador; grupo continua aberto/negociável enquanto N_actual < n_maximo';
COMMENT ON CONSTRAINT membros_grupo_estado_check ON public.membros_grupo IS 'activo|saiu|pendente|rejeitado — só activo conta para N_actual';
