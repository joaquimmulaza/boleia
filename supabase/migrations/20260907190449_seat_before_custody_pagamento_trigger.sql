-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260907190449 seat_before_custody_pagamento_trigger
-- Do not rename; Supabase Preview CI requires exact version match.

CREATE OR REPLACE FUNCTION public.trg_acordos_passageiros_create_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_take_rate numeric := 0.10;
  v_mes date := date_trunc('month', timezone('Africa/Luanda', now()))::date;
BEGIN
  IF lower(COALESCE(NEW.estado, '')) NOT IN ('activo', 'reservado') THEN
    RETURN NEW;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.acordos
  WHERE id = NEW.acordo_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Acordo não encontrado para pagamento.';
  END IF;

  INSERT INTO public.pagamentos_acordo (
    acordo_id,
    acordo_passageiro_id,
    passenger_id,
    driver_id,
    valor_kz,
    take_rate_pct,
    valor_payout_liquido_kz,
    mes_referencia
  ) VALUES (
    NEW.acordo_id,
    NEW.id,
    NEW.passenger_id,
    v_driver_id,
    NEW.quota_mensal_kz,
    v_take_rate,
    public.compute_payout_liquido_kz(NEW.quota_mensal_kz, v_take_rate),
    v_mes
  )
  ON CONFLICT (acordo_passageiro_id, mes_referencia) DO NOTHING;

  RETURN NEW;
END;
$function$;

