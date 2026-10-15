-- Regra 4 (PM) / Maestro GO: falta Motorista só desconta em pagamento de lugar activo na data_falta.
-- Fontes de vigência (acordos_passageiros):
--   início activo: MIN(validado_em) em pagamentos em_custodia/liquidado; senão created_at se estado activo/saiu/expirado.
--   fim (exclusive, Luanda): lugar_rescisao_em (justa causa) | saiu_em (leave normal, trigger) |
--   inferência valor_devido_kz proporcional (legacy saiu sem timestamp) | reservado_expira_em (expirado).
-- membros_grupo.saiu_em não aplica a acordos_passageiros.

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
  v_inicio date;
BEGIN
  SELECT * INTO v_ap
  FROM public.acordos_passageiros
  WHERE id = p_acordo_passageiro_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT MIN((timezone('Africa/Luanda', pg.validado_em))::date) INTO v_inicio
  FROM public.pagamentos_acordo pg
  WHERE pg.acordo_passageiro_id = v_ap.id
    AND pg.validado_em IS NOT NULL
    AND lower(pg.estado) IN ('em_custodia', 'liquidado', 'comprovativo_enviado');

  IF v_inicio IS NULL AND lower(v_ap.estado) IN ('activo', 'saiu', 'expirado') THEN
    v_inicio := (timezone('Africa/Luanda', v_ap.created_at))::date;
  END IF;

  RETURN v_inicio;
END;
$function$;

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
  v_quota integer;
  v_dias integer;
  v_pg record;
  d date;
  v_devido integer;
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
    RETURN public._passageiro_lugar_inicio_activo_em(v_ap.id);
  END IF;

  IF lower(v_ap.estado) <> 'saiu' THEN
    RETURN NULL;
  END IF;

  IF v_ap.lugar_rescisao_em IS NOT NULL THEN
    RETURN (timezone('Africa/Luanda', v_ap.lugar_rescisao_em))::date;
  END IF;

  IF v_ap.saiu_em IS NOT NULL THEN
    RETURN (timezone('Africa/Luanda', v_ap.saiu_em))::date;
  END IF;

  v_fim := NULL;
  v_quota := v_ap.quota_mensal_kz;
  v_dias := COALESCE(v_acordo.dias_uteis_mes, 22);

  FOR v_pg IN
    SELECT mes_referencia, valor_devido_kz, valor_quota_original_kz
    FROM public.pagamentos_acordo
    WHERE acordo_passageiro_id = v_ap.id
      AND valor_devido_kz IS NOT NULL
      AND valor_devido_kz <
        COALESCE(valor_quota_original_kz, v_quota, valor_devido_kz + 1)
  LOOP
    v_quota := COALESCE(v_pg.valor_quota_original_kz, v_quota);
    d := v_pg.mes_referencia;
    WHILE d < (v_pg.mes_referencia + INTERVAL '1 month')::date LOOP
      v_devido := public.calc_quota_proporcional_kz(v_quota, v_dias, d);
      IF v_devido = v_pg.valor_devido_kz THEN
        v_fim := GREATEST(COALESCE(v_fim, d + 1), d + 1);
        EXIT;
      END IF;
      d := d + 1;
    END LOOP;
  END LOOP;

  RETURN v_fim;
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
GRANT EXECUTE ON FUNCTION public._passageiro_lugar_inicio_activo_em(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._passageiro_lugar_inicio_activo_em(uuid) FROM anon;

REVOKE ALL ON FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._passageiro_lugar_fim_activo_exclusive_em(uuid) FROM anon;

REVOKE ALL ON FUNCTION public._passageiro_lugar_activo_em_data(uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._passageiro_lugar_activo_em_data(uuid, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._passageiro_lugar_activo_em_data(uuid, uuid, date) FROM anon;

GRANT EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._desconto_faltas_pagamento(uuid, uuid, date) FROM anon;
