-- Regra 4 (PM) / Maestro GO: falta Motorista só desconta em pagamento de lugar activo na data_falta.
-- Início activo (PM opção 3): greatest(created_at Luanda, mês do 1.º pagamento em_custodia|liquidado).
-- Fim exclusivo (Luanda): saiu_em → lugar_rescisao_em → membros_grupo.saiu_em → reservado_expira_em
--   → acordos.cancelado_em / rescisao_effective_on; senão fim := inicio (exclui lugar).
-- Falta no dia da saída não conta (p_data_falta >= fim). Reservado→saiu sem pagamento nunca activo.

ALTER TABLE public.acordos_passageiros
  ADD COLUMN IF NOT EXISTS saiu_em timestamptz;

COMMENT ON COLUMN public.acordos_passageiros.saiu_em IS
  'Instante da saída normal (leave_passenger / encerramento). Justa causa usa lugar_rescisao_em.';

CREATE OR REPLACE FUNCTION public.trg_acordos_passageiros_set_saiu_em()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $function$
BEGIN
  IF lower(NEW.estado) = 'saiu'
     AND lower(COALESCE(OLD.estado, '')) IS DISTINCT FROM 'saiu'
     AND NEW.saiu_em IS NULL THEN
    NEW.saiu_em := now();
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS acordos_passageiros_set_saiu_em ON public.acordos_passageiros;
CREATE TRIGGER acordos_passageiros_set_saiu_em
  BEFORE UPDATE OF estado ON public.acordos_passageiros
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_acordos_passageiros_set_saiu_em();

CREATE OR REPLACE FUNCTION public._passageiro_lugar_inicio_activo_em(p_acordo_passageiro_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_ap public.acordos_passageiros%ROWTYPE;
  v_created date;
  v_primeiro_mes_pago date;
BEGIN
  SELECT * INTO v_ap
  FROM public.acordos_passageiros
  WHERE id = p_acordo_passageiro_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF lower(v_ap.estado) = 'reservado' THEN
    RETURN NULL;
  END IF;

  SELECT MIN(pg.mes_referencia) INTO v_primeiro_mes_pago
  FROM public.pagamentos_acordo pg
  WHERE pg.acordo_passageiro_id = v_ap.id
    AND lower(pg.estado) IN ('em_custodia', 'liquidado');

  IF v_primeiro_mes_pago IS NULL THEN
    RETURN NULL;
  END IF;

  v_created := (timezone('Africa/Luanda', v_ap.created_at))::date;

  RETURN GREATEST(v_created, v_primeiro_mes_pago);
END;
$function$;

CREATE OR REPLACE FUNCTION public._passageiro_membro_grupo_saiu_em(
  p_acordo_id uuid,
  p_passenger_id uuid
)
RETURNS date
LANGUAGE sql
STABLE
SET search_path TO public, pg_temp
AS $$
  SELECT (timezone('Africa/Luanda', mg.saiu_em))::date
  FROM public.acordos a
  JOIN public.membros_grupo mg
    ON mg.grupo_id = a.grupo_id
   AND mg.passenger_id = p_passenger_id
  WHERE a.id = p_acordo_id
    AND a.grupo_id IS NOT NULL
    AND mg.saiu_em IS NOT NULL
  ORDER BY mg.saiu_em DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(p_acordo_passageiro_id uuid)
RETURNS date
LANGUAGE plpgsql
STABLE
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_ap public.acordos_passageiros%ROWTYPE;
  v_acordo public.acordos%ROWTYPE;
  v_fim date;
  v_inicio date;
BEGIN
  SELECT * INTO v_ap
  FROM public.acordos_passageiros
  WHERE id = p_acordo_passageiro_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = v_ap.acordo_id;

  IF lower(v_ap.estado) IN ('activo', 'reservado') THEN
    RETURN NULL;
  END IF;

  IF lower(v_ap.estado) = 'expirado' THEN
    IF v_ap.reservado_expira_em IS NOT NULL THEN
      RETURN (timezone('Africa/Luanda', v_ap.reservado_expira_em))::date;
    END IF;
    v_inicio := public._passageiro_lugar_inicio_activo_em(v_ap.id);
    RETURN v_inicio;
  END IF;

  IF v_ap.saiu_em IS NOT NULL THEN
    RETURN (timezone('Africa/Luanda', v_ap.saiu_em))::date;
  END IF;

  IF v_ap.lugar_rescisao_em IS NOT NULL THEN
    RETURN (timezone('Africa/Luanda', v_ap.lugar_rescisao_em))::date;
  END IF;

  v_fim := public._passageiro_membro_grupo_saiu_em(v_ap.acordo_id, v_ap.passenger_id);
  IF v_fim IS NOT NULL THEN
    RETURN v_fim;
  END IF;

  IF v_ap.reservado_expira_em IS NOT NULL THEN
    RETURN (timezone('Africa/Luanda', v_ap.reservado_expira_em))::date;
  END IF;

  IF v_acordo.cancelado_em IS NOT NULL THEN
    RETURN (timezone('Africa/Luanda', v_acordo.cancelado_em))::date;
  END IF;

  IF v_acordo.rescisao_effective_on IS NOT NULL THEN
    RETURN v_acordo.rescisao_effective_on;
  END IF;

  v_inicio := public._passageiro_lugar_inicio_activo_em(v_ap.id);
  RETURN v_inicio;
END;
$function$;

CREATE OR REPLACE FUNCTION public._passageiro_lugar_activo_em_data(
  p_acordo_id uuid,
  p_passenger_id uuid,
  p_data date
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_ap public.acordos_passageiros%ROWTYPE;
  v_inicio date;
  v_fim date;
BEGIN
  IF p_data IS NULL OR p_acordo_id IS NULL OR p_passenger_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_ap
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND passenger_id = p_passenger_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF lower(v_ap.estado) = 'reservado' THEN
    RETURN false;
  END IF;

  v_inicio := public._passageiro_lugar_inicio_activo_em(v_ap.id);
  IF v_inicio IS NULL OR p_data < v_inicio THEN
    RETURN false;
  END IF;

  v_fim := public._passageiro_lugar_fim_activo_exclusive_em(v_ap.id);
  IF v_fim IS NOT NULL AND p_data >= v_fim THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public._desconto_faltas_pagamento(
  p_acordo_id uuid,
  p_passenger_id uuid,
  p_mes_referencia date
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
  SELECT COALESCE(floor(COALESCE(SUM(f.desconto_kz), 0))::integer, 0)
  FROM public.faltas f
  WHERE f.id_acordo = p_acordo_id
    AND f.desconto_kz > 0
    AND COALESCE(
      f.desconto_mes_referencia,
      date_trunc('month', f.data_falta)::date
    ) = p_mes_referencia
    AND (
      (lower(f.tipo) = 'passageiro' AND f.passenger_id = p_passenger_id)
      OR (
        lower(f.tipo) = 'motorista'
        AND public._passageiro_lugar_activo_em_data(
          p_acordo_id,
          p_passenger_id,
          f.data_falta
        )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.trg_acordos_passageiros_set_saiu_em() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_acordos_passageiros_set_saiu_em() FROM anon, authenticated;

REVOKE ALL ON FUNCTION public._passageiro_lugar_inicio_activo_em(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._passageiro_lugar_inicio_activo_em(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._passageiro_lugar_inicio_activo_em(uuid) TO service_role;

REVOKE ALL ON FUNCTION public._passageiro_membro_grupo_saiu_em(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._passageiro_membro_grupo_saiu_em(uuid, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._passageiro_membro_grupo_saiu_em(uuid, uuid) TO service_role;

REVOKE ALL ON FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(uuid) TO service_role;

REVOKE ALL ON FUNCTION public._passageiro_lugar_activo_em_data(uuid, uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._passageiro_lugar_activo_em_data(uuid, uuid, date) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._passageiro_lugar_activo_em_data(uuid, uuid, date) TO service_role;

GRANT EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) FROM anon;
