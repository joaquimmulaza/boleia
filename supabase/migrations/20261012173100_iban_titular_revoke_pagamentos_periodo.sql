-- fix(sec): iban_titular só via RPC própria; renovação com quota integral em valor_devido_kz.

-- === 1. perfis: revogar SELECT de iban_titular (mantém restantes grants de prod) ===
REVOKE SELECT (iban_titular) ON TABLE public.perfis FROM authenticated, anon;

GRANT SELECT (
  id,
  nome_completo,
  tipo_perfil,
  created_at,
  onboarding_completed,
  perfil_completo
) ON TABLE public.perfis TO authenticated;

-- === 2. get_own_perfil_contacto: incluir iban_titular do dono ===
CREATE OR REPLACE FUNCTION public.get_own_perfil_contacto()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_telefone text;
  v_iban text;
  v_iban_titular text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.telefone, p.iban, p.iban_titular
  INTO v_telefone, v_iban, v_iban_titular
  FROM public.perfis p
  WHERE p.id = v_uid;

  RETURN jsonb_build_object(
    'telefone', v_telefone,
    'iban', v_iban,
    'iban_titular', v_iban_titular
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_own_perfil_contacto() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_own_perfil_contacto() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_own_perfil_contacto() TO authenticated;

-- === 3. Renovação: quota integral (valor_devido_kz = quota congelada) ===
CREATE OR REPLACE FUNCTION public._create_pagamentos_periodo(
  p_acordo_id uuid,
  p_mes_referencia date,
  p_driver_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_take_rate numeric := 0.10;
  v_count integer := 0;
  r record;
  v_new_id uuid;
  v_quota integer;
BEGIN
  IF p_acordo_id IS NULL OR p_mes_referencia IS NULL OR p_driver_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT ap.id AS ap_id, ap.passenger_id, ap.quota_mensal_kz
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND lower(ap.estado) = 'activo'
    ORDER BY ap.ordem_insercao ASC, ap.passenger_id ASC
  LOOP
    v_quota := COALESCE(r.quota_mensal_kz, 0);
    v_new_id := NULL;
    INSERT INTO public.pagamentos_acordo (
      acordo_id,
      acordo_passageiro_id,
      passenger_id,
      driver_id,
      valor_kz,
      valor_quota_original_kz,
      valor_devido_kz,
      take_rate_pct,
      valor_payout_liquido_kz,
      mes_referencia
    ) VALUES (
      p_acordo_id,
      r.ap_id,
      r.passenger_id,
      p_driver_id,
      v_quota,
      v_quota,
      v_quota,
      v_take_rate,
      public.compute_payout_liquido_kz(v_quota, v_take_rate),
      p_mes_referencia
    )
    ON CONFLICT (acordo_passageiro_id, mes_referencia) DO NOTHING
    RETURNING id INTO v_new_id;

    IF v_new_id IS NOT NULL THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$function$;

REVOKE ALL ON FUNCTION public._create_pagamentos_periodo(uuid, date, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._create_pagamentos_periodo(uuid, date, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._create_pagamentos_periodo(uuid, date, uuid) TO service_role;
