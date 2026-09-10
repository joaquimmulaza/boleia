-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260907190441 seat_before_custody_reservado_schema
-- Do not rename; Supabase Preview CI requires exact version match.

-- seat-before-custody: soft-hold reservado até em_custodia

ALTER TABLE public.acordos_passageiros
  DROP CONSTRAINT IF EXISTS acordos_passageiros_estado_check;

ALTER TABLE public.acordos_passageiros
  ADD CONSTRAINT acordos_passageiros_estado_check
  CHECK (estado = ANY (ARRAY['activo'::text, 'reservado'::text, 'saiu'::text]));

CREATE OR REPLACE FUNCTION public.oferta_ocupacao(p_oferta_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(COUNT(*), 0)::integer
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = p_oferta_id
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) IN ('activo', 'reservado');
$function$;
