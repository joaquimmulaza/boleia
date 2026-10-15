-- P0 Regra 5 (dias de viagem): falta só conta em dia de acordo (oferta.dias_semana).
-- Base: log_falta + handle_falta_desconto ← 20261015100000_faltas_regra5_desconto_mes_prazo.sql
-- accept_proposal ← 20260910100358_pacote_eng18_ttl_reserva_iban_gate_part2.sql (só a RPC)

-- dias_semana: 1=Seg … 7=Dom (ISO). NULL/vazio → Seg–Sex (fallback documentado).

CREATE OR REPLACE FUNCTION public._dias_semana_acordo_efetivos(p_dias_semana integer[])
RETURNS integer[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_dias_semana IS NULL OR cardinality(p_dias_semana) = 0 THEN ARRAY[1, 2, 3, 4, 5]::integer[]
    ELSE p_dias_semana
  END;
$$;

CREATE OR REPLACE FUNCTION public._is_dia_viagem_acordo(p_data date, p_dias_semana integer[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT EXTRACT(ISODOW FROM p_data)::integer = ANY(public._dias_semana_acordo_efetivos(p_dias_semana));
$$;

CREATE OR REPLACE FUNCTION public.count_dias_viagem_mes(p_mes_inicio date, p_dias_semana integer[])
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(COUNT(*)::integer, 0)
  FROM generate_series(
    p_mes_inicio,
    (p_mes_inicio + interval '1 month' - interval '1 day')::date,
    interval '1 day'
  ) AS d
  WHERE EXTRACT(ISODOW FROM d)::integer = ANY(public._dias_semana_acordo_efetivos(p_dias_semana));
$$;

CREATE OR REPLACE FUNCTION public.handle_falta_desconto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor_mensal integer;
  v_dias integer;
  v_passenger_id uuid;
  v_dias_semana integer[];
BEGIN
  v_passenger_id := COALESCE(
    NEW.passenger_id,
    CASE WHEN lower(COALESCE(NEW.tipo, '')) = 'passageiro' THEN auth.uid() ELSE NULL END
  );

  NEW.desconto_mes_referencia := public._resolve_desconto_mes_falta(
    NEW.id_acordo,
    v_passenger_id,
    NEW.data_falta,
    NEW.tipo
  );

  SELECT oc.dias_semana
  INTO v_dias_semana
  FROM public.acordos a
  JOIN public.ofertas_capacidade oc ON oc.id = a.oferta_id
  WHERE a.id = NEW.id_acordo;

  IF NOT public._is_dia_viagem_acordo(NEW.data_falta, v_dias_semana) THEN
    NEW.desconto_kz := 0;
    RETURN NEW;
  END IF;

  IF NOT public.pagamento_em_custodia_para_falta(NEW.id_acordo, NEW.tipo, v_passenger_id) THEN
    NEW.desconto_kz := 0;
    RETURN NEW;
  END IF;

  SELECT a.valor_mensal_por_passageiro_kz, a.dias_uteis_mes
  INTO v_valor_mensal, v_dias
  FROM public.acordos a
  WHERE a.id = NEW.id_acordo;

  IF v_valor_mensal IS NOT NULL AND v_dias IS NOT NULL AND v_dias > 0 THEN
    IF NEW.viagem = 'ambas' THEN
      NEW.desconto_kz := ROUND((v_valor_mensal::numeric / v_dias::numeric), 2);
    ELSE
      NEW.desconto_kz := ROUND((v_valor_mensal::numeric / v_dias::numeric / 2.0), 2);
    END IF;
  ELSE
    NEW.desconto_kz := 0;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.log_falta(
  p_id_acordo uuid,
  p_data_falta date,
  p_tipo text,
  p_observacao text DEFAULT NULL,
  p_passenger_id uuid DEFAULT NULL,
  p_viagem text DEFAULT 'ambas'
)
RETURNS public.faltas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_tipo text := initcap(lower(btrim(COALESCE(p_tipo, ''))));
  v_viagem text := lower(btrim(COALESCE(p_viagem, 'ambas')));
  v_passenger_id uuid;
  v_is_driver boolean;
  v_is_passenger boolean;
  v_dias_semana integer[];
  v_row public.faltas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_id_acordo IS NULL OR p_data_falta IS NULL THEN
    RAISE EXCEPTION 'Acordo e data são obrigatórios.';
  END IF;

  IF v_tipo NOT IN ('Passageiro', 'Motorista') THEN
    RAISE EXCEPTION 'Tipo de falta inválido.';
  END IF;

  IF v_viagem NOT IN ('ida', 'regresso', 'ambas') THEN
    RAISE EXCEPTION 'Viagem inválida.';
  END IF;

  SELECT oc.dias_semana
  INTO v_dias_semana
  FROM public.acordos a
  JOIN public.ofertas_capacidade oc ON oc.id = a.oferta_id
  WHERE a.id = p_id_acordo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF NOT public._is_dia_viagem_acordo(p_data_falta, v_dias_semana) THEN
    RAISE EXCEPTION 'Esta data não é dia de viagem neste acordo.'
      USING ERRCODE = 'BCF03';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.acordos a
    WHERE a.id = p_id_acordo AND a.driver_id = v_uid
  ) INTO v_is_driver;

  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_id_acordo
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_passenger;

  IF NOT v_is_driver AND NOT v_is_passenger THEN
    RAISE EXCEPTION 'Sem permissão para registar faltas neste acordo.';
  END IF;

  IF v_tipo = 'Passageiro' THEN
    v_passenger_id := COALESCE(p_passenger_id, v_uid);

    IF v_passenger_id IS DISTINCT FROM v_uid AND NOT v_is_driver THEN
      RAISE EXCEPTION 'Só o motorista pode registar falta de outro passageiro.';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.acordos_passageiros ap
      WHERE ap.acordo_id = p_id_acordo
        AND ap.passenger_id = v_passenger_id
        AND lower(ap.estado) = 'activo'
    ) THEN
      RAISE EXCEPTION 'Passageiro não activo neste acordo.';
    END IF;

    IF v_passenger_id = v_uid
      AND NOT public._passageiro_falta_aviso_valido(p_data_falta, public._falta_regra5_instant()) THEN
      RAISE EXCEPTION
        'Já não é possível registar esta falta. Só podes avisar até às 22:00 do dia anterior.'
        USING ERRCODE = 'BCF02';
    END IF;
  ELSE
    v_passenger_id := NULL;

    IF NOT v_is_driver THEN
      RAISE EXCEPTION 'Só o motorista pode registar falta de motorista.';
    END IF;
  END IF;

  IF NOT public.pagamento_em_custodia_para_falta(p_id_acordo, v_tipo, v_passenger_id) THEN
    RAISE EXCEPTION
      'Registo de faltas disponível após pagamento validado em custódia.';
  END IF;

  INSERT INTO public.faltas (
    id_acordo,
    data_falta,
    tipo,
    observacao,
    passenger_id,
    viagem
  ) VALUES (
    p_id_acordo,
    p_data_falta,
    v_tipo,
    NULLIF(btrim(COALESCE(p_observacao, '')), ''),
    v_passenger_id,
    v_viagem
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_proposal(
  p_proposta_id uuid,
  p_member_ids uuid[] DEFAULT NULL::uuid[],
  p_idempotency_key uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.propostas%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
  v_ocupadas integer;
  v_disponiveis integer;
  v_n integer;
  v_total integer;
  v_base integer;
  v_resto integer;
  v_acordo_id uuid;
  v_uid uuid := auth.uid();
  v_member_id uuid;
  v_membro public.membros_grupo%ROWTYPE;
  v_ids uuid[];
  v_seen uuid[] := ARRAY[]::uuid[];
  i integer := 0;
  v_quota integer;
  v_expira timestamptz := now() + (public.reserva_ttl_hours() || ' hours')::interval;
  v_dias_uteis_mes integer;
  v_mes_ref date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      SELECT subject_id INTO v_acordo_id
      FROM public.rpc_idempotency
      WHERE idempotency_key = p_idempotency_key;
      RETURN v_acordo_id;
    END IF;
  END IF;

  SELECT * INTO v_prop FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada.';
  END IF;
  IF v_prop.estado <> 'aberta' THEN
    RAISE EXCEPTION 'Proposta não está aberta.';
  END IF;

  IF v_uid = v_prop.created_by THEN
    RAISE EXCEPTION 'Só a contraparte pode aceitar ou rejeitar esta proposta.';
  END IF;

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = v_prop.oferta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = v_prop.procura_id;
  IF v_uid IS DISTINCT FROM v_oferta.driver_id AND v_uid IS DISTINCT FROM v_procura.owner_id THEN
    RAISE EXCEPTION 'Sem permissão para aceitar esta proposta.';
  END IF;

  SELECT COALESCE(COUNT(*), 0) INTO v_ocupadas
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = v_oferta.id
    AND lower(a.estado) IN ('activo', 'cancelamento_pendente')
    AND lower(ap.estado) IN ('activo', 'reservado');

  v_disponiveis := v_oferta.vagas_totais - v_ocupadas;
  v_n := v_prop.n_passageiros_propostos;

  IF v_n > v_disponiveis THEN
    RAISE EXCEPTION 'Vagas insuficientes para este grupo. Use lista de espera.';
  END IF;

  IF v_prop.modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := v_prop.valor_mensal_ask_kz;
    v_total := v_base * v_n;
    v_resto := 0;
  ELSIF v_prop.modo_preco = 'TOTAL_ACORDO' THEN
    v_total := v_prop.valor_mensal_ask_kz;
    v_base := v_total / v_n;
    v_resto := v_total % v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  v_mes_ref := date_trunc(
    'month',
    (now() AT TIME ZONE 'Africa/Luanda')::date
  )::date;
  v_dias_uteis_mes := public.count_dias_viagem_mes(v_mes_ref, v_oferta.dias_semana);

  INSERT INTO public.acordos (
    oferta_id, procura_id, grupo_id, driver_id,
    modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz,
    dias_uteis_mes,
    estado
  ) VALUES (
    v_prop.oferta_id, v_prop.procura_id, v_prop.grupo_id, v_oferta.driver_id,
    v_prop.modo_preco, v_n,
    v_total, v_base,
    v_dias_uteis_mes,
    'activo'
  ) RETURNING id INTO v_acordo_id;

  IF v_prop.grupo_id IS NOT NULL THEN
    v_ids := COALESCE(p_member_ids, ARRAY[]::uuid[]);

    IF cardinality(v_ids) IS DISTINCT FROM v_n THEN
      RAISE EXCEPTION 'Capacidade inconsistente com proposta';
    END IF;

    FOREACH v_member_id IN ARRAY v_ids
    LOOP
      IF v_member_id = ANY (v_seen) THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
      v_seen := array_append(v_seen, v_member_id);

      SELECT *
      INTO v_membro
      FROM public.membros_grupo
      WHERE grupo_id = v_prop.grupo_id
        AND passenger_id = v_member_id
        AND lower(estado) = 'activo';

      IF NOT FOUND THEN
        RAISE EXCEPTION
          'Membro % não está activo no grupo da proposta.',
          v_member_id;
      END IF;

      IF v_prop.modo_preco = 'POR_PASSAGEIRO' THEN
        v_quota := v_base;
      ELSE
        v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
      END IF;

      INSERT INTO public.acordos_passageiros (
        acordo_id, passenger_id, quota_mensal_kz, ordem_insercao,
        pickup_name, pickup_lat, pickup_lng,
        dropoff_name, dropoff_lat, dropoff_lng,
        estado, reservado_expira_em
      ) VALUES (
        v_acordo_id, v_membro.passenger_id, v_quota, i,
        v_membro.pickup_name, v_membro.pickup_lat, v_membro.pickup_lng,
        v_membro.dropoff_name, v_membro.dropoff_lat, v_membro.dropoff_lng,
        'reservado', v_expira
      );
      i := i + 1;
    END LOOP;
  ELSE
    IF v_n <> 1 THEN
      RAISE EXCEPTION 'Proposta sem grupo exige n_passageiros_propostos = 1.';
    END IF;

    IF p_member_ids IS NOT NULL AND cardinality(p_member_ids) > 0 THEN
      IF cardinality(p_member_ids) <> 1 OR p_member_ids[1] IS DISTINCT FROM v_procura.owner_id THEN
        RAISE EXCEPTION 'Capacidade inconsistente com proposta';
      END IF;
    END IF;

    INSERT INTO public.acordos_passageiros (
      acordo_id, passenger_id, quota_mensal_kz, ordem_insercao, estado, reservado_expira_em
    ) VALUES (
      v_acordo_id, v_procura.owner_id, v_base, 0, 'reservado', v_expira
    );
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  SELECT
    ap.passenger_id,
    'Acordo formado: o teu lugar está reservado. Confirma o pagamento em '
      || public.reserva_ttl_hours()::text
      || ' horas para activar o lugar.',
    'success',
    jsonb_build_object(
      'type', 'agreement_update',
      'acordo_id', v_acordo_id,
      'reserva_expira_em', v_expira
    )
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = v_acordo_id AND lower(ap.estado) = 'reservado';

  PERFORM public.recount_oferta_vagas(v_oferta.id);

  UPDATE public.propostas
  SET
    estado = 'aceite',
    valor_mensal_por_passageiro_resolvido_kz = v_base,
    valor_mensal_total_resolvido_kz = v_total,
    updated_at = now()
  WHERE id = v_prop.id;

  UPDATE public.propostas
  SET estado = 'cancelada', updated_at = now()
  WHERE procura_id = v_prop.procura_id
    AND id <> v_prop.id
    AND estado = 'aberta';

  UPDATE public.procuras
  SET estado = 'fechada', updated_at = now()
  WHERE id = v_prop.procura_id;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'accept_proposal', v_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public._dias_semana_acordo_efetivos(integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._dias_semana_acordo_efetivos(integer[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._dias_semana_acordo_efetivos(integer[]) TO service_role;

REVOKE ALL ON FUNCTION public._is_dia_viagem_acordo(date, integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._is_dia_viagem_acordo(date, integer[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._is_dia_viagem_acordo(date, integer[]) TO service_role;

GRANT EXECUTE ON FUNCTION public.count_dias_viagem_mes(date, integer[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.count_dias_viagem_mes(date, integer[]) FROM anon;

GRANT EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_falta(uuid, date, text, text, uuid, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.accept_proposal(uuid, uuid[], uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_proposal(uuid, uuid[], uuid) FROM anon;
