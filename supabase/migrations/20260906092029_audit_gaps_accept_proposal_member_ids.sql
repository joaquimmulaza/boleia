-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906092029 audit_gaps_accept_proposal_member_ids
-- Do not rename; Supabase Preview CI requires exact version match.

DROP FUNCTION IF EXISTS public.accept_proposal(uuid, uuid);
DROP FUNCTION IF EXISTS public.accept_proposal(uuid, uuid[], uuid);

CREATE OR REPLACE FUNCTION public.accept_proposal(
  p_proposta_id uuid,
  p_member_ids uuid[] DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
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
    AND a.estado = 'activo'
    AND ap.estado = 'activo';

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

  INSERT INTO public.acordos (
    oferta_id, procura_id, grupo_id, driver_id,
    modo_preco, n_passageiros_contrato,
    valor_mensal_total_kz, valor_mensal_por_passageiro_kz,
    estado
  ) VALUES (
    v_prop.oferta_id, v_prop.procura_id, v_prop.grupo_id, v_oferta.driver_id,
    v_prop.modo_preco, v_n,
    v_total, v_base,
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
        estado
      ) VALUES (
        v_acordo_id, v_membro.passenger_id, v_quota, i,
        v_membro.pickup_name, v_membro.pickup_lat, v_membro.pickup_lng,
        v_membro.dropoff_name, v_membro.dropoff_lat, v_membro.dropoff_lng,
        'activo'
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
      acordo_id, passenger_id, quota_mensal_kz, ordem_insercao, estado
    ) VALUES (
      v_acordo_id, v_procura.owner_id, v_base, 0, 'activo'
    );
  END IF;

  INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
  SELECT
    ap.passenger_id,
    'O teu acordo de boleia foi confirmado.',
    'success',
    jsonb_build_object('type', 'agreement_update', 'acordo_id', v_acordo_id)
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = v_acordo_id AND ap.estado = 'activo';

  v_disponiveis := v_oferta.vagas_totais - (v_ocupadas + v_n);
  UPDATE public.ofertas_capacidade
  SET
    vagas_disponiveis = v_disponiveis,
    estado = CASE
      WHEN v_disponiveis = 0 THEN 'cheia'
      WHEN v_disponiveis < vagas_totais THEN 'parcial'
      ELSE 'disponivel'
    END,
    updated_at = now()
  WHERE id = v_oferta.id;

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

REVOKE ALL ON FUNCTION public.accept_proposal(uuid, uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_proposal(uuid, uuid[], uuid) TO authenticated;
