-- Already applied on production as version 20261004073111.
-- This file only puts that version in the local migrations directory.
-- Do not edit the version and do not run this against production again.
-- Does not revoke anon grants.

REVOKE SELECT ON TABLE public.perfis FROM authenticated;

GRANT SELECT (
  id,
  nome_completo,
  tipo_perfil,
  created_at,
  onboarding_completed,
  iban_titular,
  perfil_completo
) ON TABLE public.perfis TO authenticated;

CREATE OR REPLACE FUNCTION public.lookup_perfil_por_telefone(p_telefone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clean text;
  v_e164 text;
  v_id uuid;
  v_nome text;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  v_clean := regexp_replace(COALESCE(p_telefone, ''), '[[:space:]-]', '', 'g');
  IF v_clean !~ '^(\+244)?9[0-9]{8}$' THEN
    RAISE EXCEPTION 'Número de telefone inválido. Use o formato: 9XXXXXXXX ou +244 9XXXXXXXX.';
  END IF;

  IF left(v_clean, 4) = '+244' THEN
    v_e164 := v_clean;
  ELSE
    v_e164 := '+244' || v_clean;
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.perfis
  WHERE telefone = v_e164;

  IF v_count > 1 THEN
    RAISE EXCEPTION 'Mais do que um perfil com este telefone.';
  END IF;

  SELECT p.id, p.nome_completo INTO v_id, v_nome
  FROM public.perfis p
  WHERE p.telefone = v_e164;

  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'nome_completo', v_nome);
END;
$function$;

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT p.telefone, p.iban INTO v_telefone, v_iban
  FROM public.perfis p
  WHERE p.id = v_uid;

  RETURN jsonb_build_object('telefone', v_telefone, 'iban', v_iban);
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_motoristas_tem_iban(p_driver_ids uuid[])
 RETURNS TABLE(driver_id uuid, completo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  RETURN QUERY
  SELECT d.id,
    (
      NULLIF(btrim(COALESCE(p.iban, '')), '') IS NOT NULL
      AND NULLIF(btrim(COALESCE(p.iban_titular, '')), '') IS NOT NULL
    )
  FROM unnest(COALESCE(p_driver_ids, ARRAY[]::uuid[])) AS d(id)
  LEFT JOIN public.perfis p ON p.id = d.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.lookup_perfil_por_telefone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_perfil_contacto() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_motoristas_tem_iban(uuid[]) TO anon, authenticated;
