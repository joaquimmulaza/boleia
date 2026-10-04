-- Already applied on production as version 20261004072610.
-- This file only puts that version in the local migrations directory.
-- Do not edit the version and do not run this against production again.

CREATE OR REPLACE FUNCTION public.delete_own_account()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'storage'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ofertas uuid[];
  v_procuras uuid[];
  v_oferta uuid;
  v_procura uuid;
  v_n integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  UPDATE public.pagamentos_acordo
  SET validado_por = NULL
  WHERE validado_por = v_uid;

  UPDATE public.repasses_motorista
  SET liquidado_por = NULL
  WHERE liquidado_por = v_uid;

  UPDATE public.pagamentos_acordo
  SET repasse_id = NULL
  WHERE repasse_id IN (
    SELECT id FROM public.repasses_motorista WHERE driver_id = v_uid
  );

  DELETE FROM public.acordos
  WHERE driver_id = v_uid
     OR oferta_id IN (
       SELECT id FROM public.ofertas_capacidade WHERE driver_id = v_uid
     );

  DELETE FROM public.ofertas_capacidade
  WHERE driver_id = v_uid;

  DELETE FROM public.repasses_motorista
  WHERE driver_id = v_uid;

  PERFORM set_config('storage.allow_delete_query', 'true', true);

  DELETE FROM storage.objects
  WHERE bucket_id = 'comprovativos-pagamento'
    AND (
      owner = v_uid
      OR owner_id = v_uid::text
      OR name LIKE v_uid::text || '/%'
    );

  SELECT COALESCE(array_agg(DISTINCT a.oferta_id), '{}')
  INTO v_ofertas
  FROM public.acordos a
  JOIN public.acordos_passageiros ap ON ap.acordo_id = a.id
  WHERE ap.passenger_id = v_uid
    AND lower(ap.estado) IN ('activo', 'reservado')
    AND a.driver_id IS DISTINCT FROM v_uid;

  SELECT COALESCE(array_agg(DISTINCT g.procura_id), '{}')
  INTO v_procuras
  FROM public.membros_grupo m
  JOIN public.grupos g ON g.id = m.grupo_id
  JOIN public.procuras p ON p.id = g.procura_id
  WHERE m.passenger_id = v_uid
    AND lower(m.estado) = 'activo'
    AND p.owner_id IS DISTINCT FROM v_uid;

  DELETE FROM auth.users
  WHERE id = v_uid;

  FOREACH v_oferta IN ARRAY v_ofertas LOOP
    PERFORM public.recount_oferta_vagas(v_oferta);
    BEGIN
      PERFORM public.promote_waitlist(v_oferta);
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Falha best-effort promote_waitlist ao apagar conta %: %',
          v_uid, SQLERRM;
    END;
  END LOOP;

  FOREACH v_procura IN ARRAY v_procuras LOOP
    SELECT COUNT(*)::integer INTO v_n
    FROM public.membros_grupo m
    JOIN public.grupos g ON g.id = m.grupo_id
    WHERE g.procura_id = v_procura
      AND lower(m.estado) = 'activo';

    IF v_n >= 1 THEN
      UPDATE public.procuras
      SET n_candidato = v_n,
          updated_at = now()
      WHERE id = v_procura;
    END IF;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
