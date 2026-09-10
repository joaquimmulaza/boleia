-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)

-- PACOTE ENG #18 — TTL reservas (B1) + gate IBAN liquidação (B4)

-- === B1: schema reserva com TTL ===
ALTER TABLE public.acordos_passageiros
  ADD COLUMN IF NOT EXISTS reservado_expira_em timestamptz;

ALTER TABLE public.acordos_passageiros
  DROP CONSTRAINT IF EXISTS acordos_passageiros_estado_check;

ALTER TABLE public.acordos_passageiros
  ADD CONSTRAINT acordos_passageiros_estado_check
  CHECK (estado = ANY (ARRAY['activo'::text, 'reservado'::text, 'saiu'::text, 'expirado'::text]));

COMMENT ON COLUMN public.acordos_passageiros.reservado_expira_em IS
  'Prazo limite do soft-hold reservado (72h piloto). NULL fora de reservado.';

-- Backfill reservas activas sem prazo
UPDATE public.acordos_passageiros
SET reservado_expira_em = created_at + INTERVAL '72 hours'
WHERE lower(estado) = 'reservado'
  AND reservado_expira_em IS NULL;

CREATE OR REPLACE FUNCTION public.reserva_ttl_hours()
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 72;
$$;

-- oferta_ocupacao: só activo + reservado (expirado não ocupa)
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

-- === B1: lazy expiry (espelha apply_due_agreement_terminations) ===
CREATE OR REPLACE FUNCTION public.apply_due_reserva_expiry(p_acordo_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_oferta_ids uuid[] := ARRAY[]::uuid[];
  v_oferta_id uuid;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT ap.id, ap.acordo_id, ap.passenger_id, a.oferta_id
    FROM public.acordos_passageiros ap
    JOIN public.acordos a ON a.id = ap.acordo_id
    WHERE lower(ap.estado) = 'reservado'
      AND ap.reservado_expira_em IS NOT NULL
      AND ap.reservado_expira_em <= now()
      AND (p_acordo_id IS NULL OR ap.acordo_id = p_acordo_id)
      AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
      AND NOT EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.acordo_passageiro_id = ap.id
          AND lower(pg.estado) IN ('comprovativo_enviado', 'em_custodia', 'liquidado')
      )
    FOR UPDATE OF ap
  LOOP
    UPDATE public.acordos_passageiros
    SET
      estado = 'expirado',
      reservado_expira_em = NULL
    WHERE id = v_row.id;

    UPDATE public.pagamentos_acordo
    SET
      estado = 'reembolsado',
      updated_at = now()
    WHERE acordo_passageiro_id = v_row.id
      AND lower(estado) = 'pendente_pagamento';

    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    VALUES (
      v_row.passenger_id,
      'A tua reserva expirou por falta de pagamento a tempo. A vaga foi libertada.',
      'warning',
      jsonb_build_object(
        'type', 'reserva_expirada',
        'acordo_id', v_row.acordo_id,
        'inbox', 'passageiro'
      )
    );

    IF v_row.oferta_id IS NOT NULL AND NOT (v_row.oferta_id = ANY (v_oferta_ids)) THEN
      v_oferta_ids := array_append(v_oferta_ids, v_row.oferta_id);
    END IF;

    v_count := v_count + 1;
  END LOOP;

  FOREACH v_oferta_id IN ARRAY v_oferta_ids
  LOOP
    PERFORM public.recount_oferta_vagas(v_oferta_id);
    BEGIN
      PERFORM public.promote_waitlist(v_oferta_id);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist após expiry oferta %: %',
          v_oferta_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_reserva_expiry(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.reserva_ttl_hours() TO authenticated;
