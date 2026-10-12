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
    RAISE EXCEPTION 'Não autenticado.';
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

GRANT EXECUTE ON FUNCTION public.get_own_perfil_contacto() TO anon, authenticated;

-- === 3. Passageiro (ou motorista) no acordo: IBAN do motorista sem SELECT em perfis ===
CREATE OR REPLACE FUNCTION public.get_acordo_motorista_dados_bancarios(p_acordo_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_is_driver boolean;
  v_is_participant boolean;
  v_iban text;
  v_titular text;
BEGIN
  IF v_uid IS NULL OR p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  v_is_driver := v_uid = v_acordo.driver_id;
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) IN ('activo', 'reservado')
  ) INTO v_is_participant;

  IF NOT v_is_driver AND NOT v_is_participant AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sem permissão para ver dados bancários deste acordo.';
  END IF;

  SELECT NULLIF(btrim(COALESCE(p.iban, '')), ''),
         NULLIF(btrim(COALESCE(p.iban_titular, '')), '')
  INTO v_iban, v_titular
  FROM public.perfis p
  WHERE p.id = v_acordo.driver_id;

  RETURN jsonb_build_object('iban', v_iban, 'iban_titular', v_titular);
END;
$function$;

REVOKE ALL ON FUNCTION public.get_acordo_motorista_dados_bancarios(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_acordo_motorista_dados_bancarios(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_acordo_motorista_dados_bancarios(uuid) TO authenticated;

-- === 4. Renovação: quota integral (valor_devido_kz = quota congelada) ===
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
