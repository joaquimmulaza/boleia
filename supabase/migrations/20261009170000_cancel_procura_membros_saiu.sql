-- cancel_procura + leave_grupo_membro: membros saiu/rejeitado; grupo aberto enquanto houver activo.
-- Schema: saiu_em e grupos.estado não existiam — adicionados aqui (IF NOT EXISTS).

ALTER TABLE public.membros_grupo
  ADD COLUMN IF NOT EXISTS saiu_em timestamptz;

COMMENT ON COLUMN public.membros_grupo.saiu_em IS
  'Carimbo quando o membro passou a estado saiu (cancel_procura, leave_grupo_membro, etc.).';

ALTER TABLE public.grupos
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'aberto';

ALTER TABLE public.grupos
  DROP CONSTRAINT IF EXISTS grupos_estado_check;

ALTER TABLE public.grupos
  ADD CONSTRAINT grupos_estado_check
  CHECK (estado = ANY (ARRAY['aberto'::text, 'fechado'::text]));

COMMENT ON COLUMN public.grupos.estado IS 'aberto|fechado — fechado quando não há membros activos';

CREATE OR REPLACE FUNCTION public._sync_grupo_pos_cancel_procura(
  p_grupo_id uuid,
  p_owner_id uuid,
  p_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n_activos integer;
BEGIN
  IF p_grupo_id IS NULL OR p_owner_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.membros_grupo
  SET
    estado = 'saiu',
    saiu_em = p_at
  WHERE grupo_id = p_grupo_id
    AND passenger_id = p_owner_id
    AND lower(estado) = 'activo';

  UPDATE public.membros_grupo
  SET estado = 'rejeitado'
  WHERE grupo_id = p_grupo_id
    AND lower(estado) = 'pendente';

  SELECT COUNT(*)::integer INTO v_n_activos
  FROM public.membros_grupo
  WHERE grupo_id = p_grupo_id
    AND lower(estado) = 'activo';

  IF v_n_activos < 1 THEN
    UPDATE public.grupos
    SET estado = 'fechado'
    WHERE id = p_grupo_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._close_grupo_se_zero_activos(p_grupo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_n_activos integer;
BEGIN
  SELECT COUNT(*)::integer INTO v_n_activos
  FROM public.membros_grupo
  WHERE grupo_id = p_grupo_id
    AND lower(estado) = 'activo';

  IF v_n_activos < 1 THEN
    UPDATE public.grupos
    SET estado = 'fechado'
    WHERE id = p_grupo_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_procura(p_procura_id uuid)
RETURNS public.procuras
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_procura public.procuras%ROWTYPE;
  v_prop public.propostas%ROWTYPE;
  v_grupo_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_procura FROM public.procuras WHERE id = p_procura_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura não encontrada.';
  END IF;

  PERFORM public._assert_procura_editavel(v_procura, v_uid);

  UPDATE public.procuras
  SET estado = 'cancelada', updated_at = v_now
  WHERE id = p_procura_id
  RETURNING * INTO v_procura;

  FOR v_prop IN
    SELECT * FROM public.propostas
    WHERE procura_id = p_procura_id AND estado = 'aberta'
    FOR UPDATE
  LOOP
    UPDATE public.propostas
    SET estado = 'cancelada', updated_at = v_now
    WHERE id = v_prop.id;
    v_prop.estado := 'cancelada';
    PERFORM public._notify_proposta_driver_evento(
      v_prop,
      'proposal_cancelled',
      'A procura foi cancelada. Esta proposta ficou sem efeito.'
    );
  END LOOP;

  UPDATE public.lista_espera
  SET estado = 'cancelada'
  WHERE procura_id = p_procura_id
    AND estado IN ('activa', 'notificada');

  SELECT g.id INTO v_grupo_id
  FROM public.grupos g
  WHERE g.procura_id = p_procura_id
  FOR UPDATE;

  IF FOUND THEN
    PERFORM public._sync_grupo_pos_cancel_procura(v_grupo_id, v_uid, v_now);
  END IF;

  RETURN v_procura;
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_grupo_membro(
  p_grupo_id uuid,
  p_passenger_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS public.membros_grupo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_membro public.membros_grupo%ROWTYPE;
  v_n_activos integer;
  v_procura_id uuid;
  v_procura_estado text;
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'grupo_id é obrigatório.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      v_target := COALESCE(p_passenger_id, v_uid);
      SELECT * INTO v_membro
      FROM public.membros_grupo
      WHERE grupo_id = p_grupo_id
        AND passenger_id = v_target;
      IF FOUND THEN
        RETURN v_membro;
      END IF;
      v_membro.grupo_id := p_grupo_id;
      v_membro.passenger_id := v_target;
      v_membro.estado := 'saiu';
      RETURN v_membro;
    END IF;
  END IF;

  v_target := COALESCE(p_passenger_id, v_uid);

  IF v_uid IS DISTINCT FROM v_target THEN
    RAISE EXCEPTION 'Só podes sair do grupo por ti próprio.';
  END IF;

  SELECT g.procura_id INTO v_procura_id
  FROM public.grupos g
  WHERE g.id = p_grupo_id;

  IF v_procura_id IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado.';
  END IF;

  SELECT lower(p.estado) INTO v_procura_estado
  FROM public.procuras p
  WHERE p.id = v_procura_id
  FOR UPDATE;

  PERFORM 1
  FROM public.grupos g
  WHERE g.id = p_grupo_id
  FOR UPDATE;

  SELECT * INTO v_membro
  FROM public.membros_grupo
  WHERE grupo_id = p_grupo_id
    AND passenger_id = v_target
  FOR UPDATE;

  IF NOT FOUND OR lower(v_membro.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Não estás activo neste grupo.';
  END IF;

  SELECT COUNT(*)::integer INTO v_n_activos
  FROM public.membros_grupo
  WHERE grupo_id = p_grupo_id
    AND lower(estado) = 'activo';

  IF v_procura_estado <> 'cancelada' AND v_n_activos <= 1 THEN
    RAISE EXCEPTION 'Não podes sair: és o único membro activo do grupo.';
  END IF;

  UPDATE public.membros_grupo
  SET
    estado = 'saiu',
    saiu_em = v_now
  WHERE id = v_membro.id
  RETURNING * INTO v_membro;

  SELECT COUNT(*)::integer INTO v_n_activos
  FROM public.membros_grupo
  WHERE grupo_id = p_grupo_id
    AND lower(estado) = 'activo';

  IF v_n_activos < 1 THEN
    PERFORM public._close_grupo_se_zero_activos(p_grupo_id);
  ELSIF v_procura_estado <> 'cancelada' THEN
    UPDATE public.procuras
    SET
      n_candidato = v_n_activos,
      updated_at = v_now
    WHERE id = v_procura_id;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_grupo_membro', p_grupo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_membro;
END;
$function$;

-- INSERT: grupo aberto + procura negociável (activa|em_negociacao)
CREATE OR REPLACE FUNCTION public.trg_membros_grupo_insert_estado_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_grupo_estado text;
  v_procura_estado text;
BEGIN
  IF lower(COALESCE(NEW.estado, '')) NOT IN ('activo', 'pendente') THEN
    RAISE EXCEPTION 'Estado inicial inválido para membro de grupo.';
  END IF;

  SELECT lower(g.estado), lower(p.estado)
  INTO v_grupo_estado, v_procura_estado
  FROM public.grupos g
  INNER JOIN public.procuras p ON p.id = g.procura_id
  WHERE g.id = NEW.grupo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo não encontrado.';
  END IF;

  IF v_grupo_estado <> 'aberto' THEN
    RAISE EXCEPTION 'Este grupo está fechado.';
  END IF;

  IF v_procura_estado NOT IN ('activa', 'em_negociacao') THEN
    RAISE EXCEPTION 'Não é possível pedir entrada nesta procura.';
  END IF;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS membros_insert_envolvidos ON public.membros_grupo;

CREATE POLICY membros_insert_envolvidos
  ON public.membros_grupo
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.grupos g
      INNER JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = membros_grupo.grupo_id
        AND lower(g.estado) = 'aberto'
        AND lower(p.estado) IN ('activa', 'em_negociacao')
    )
    AND (
      auth.uid() = (
        SELECT p.owner_id
        FROM public.grupos g
        JOIN public.procuras p ON p.id = g.procura_id
        WHERE g.id = membros_grupo.grupo_id
      )
      OR (
        auth.uid() = passenger_id
        AND lower(estado) = 'pendente'
      )
    )
  );

CREATE OR REPLACE FUNCTION public.trg_membros_grupo_passenger_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_owner uuid;
  v_grupo_estado text;
  v_procura_estado text;
BEGIN
  -- RPC SECURITY DEFINER (leave_grupo_membro, cancel_procura) actualiza estado; não bloquear.
  IF auth.uid() IS NULL OR current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT p.owner_id, lower(g.estado), lower(p.estado)
  INTO v_owner, v_grupo_estado, v_procura_estado
  FROM public.grupos g
  JOIN public.procuras p ON p.id = g.procura_id
  WHERE g.id = NEW.grupo_id;

  IF (v_grupo_estado = 'fechado' OR v_procura_estado = 'cancelada')
     AND lower(NEW.estado) IN ('activo', 'pendente')
     AND lower(NEW.estado) IS DISTINCT FROM lower(OLD.estado) THEN
    RAISE EXCEPTION 'Este grupo está fechado.';
  END IF;

  IF lower(OLD.estado) = 'saiu'
     AND lower(NEW.estado) IS DISTINCT FROM lower(OLD.estado) THEN
    NEW.saiu_em := NULL;
  END IF;

  IF auth.uid() IS DISTINCT FROM v_owner AND auth.uid() = NEW.passenger_id THEN
    IF NEW.grupo_id IS DISTINCT FROM OLD.grupo_id
       OR NEW.passenger_id IS DISTINCT FROM OLD.passenger_id THEN
      RAISE EXCEPTION 'Não podes alterar o grupo deste pedido.';
    END IF;

    IF lower(NEW.estado) IS DISTINCT FROM lower(OLD.estado)
       AND NOT (
         lower(OLD.estado) IN ('rejeitado', 'saiu', 'pendente')
         AND lower(NEW.estado) = 'pendente'
       ) THEN
      RAISE EXCEPTION 'Não podes alterar o estado deste pedido.';
    END IF;

    IF lower(NEW.estado) IS NOT DISTINCT FROM lower(OLD.estado)
       AND NEW.ordem_insercao IS DISTINCT FROM OLD.ordem_insercao THEN
      RAISE EXCEPTION 'Não podes alterar a ordem de inserção neste pedido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Backfill is_test: mesma lógica que cancel_procura (_sync_grupo_pos_cancel_procura)
DO $$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT
      g.id AS grupo_id,
      p.owner_id,
      COALESCE(p.updated_at, p.created_at, now()) AS sai_at
    FROM public.grupos g
    INNER JOIN public.procuras p ON p.id = g.procura_id
    WHERE p.is_test = true
      AND lower(p.estado) = 'cancelada'
  LOOP
    PERFORM public._sync_grupo_pos_cancel_procura(
      v_row.grupo_id,
      v_row.owner_id,
      v_row.sai_at
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public._sync_grupo_pos_cancel_procura(uuid, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_grupo_pos_cancel_procura(uuid, uuid, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public._sync_grupo_pos_cancel_procura(uuid, uuid, timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._sync_grupo_pos_cancel_procura(uuid, uuid, timestamptz) TO service_role;

REVOKE ALL ON FUNCTION public._close_grupo_se_zero_activos(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._close_grupo_se_zero_activos(uuid) FROM anon;
REVOKE ALL ON FUNCTION public._close_grupo_se_zero_activos(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public._close_grupo_se_zero_activos(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_procura(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.leave_grupo_membro(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_grupo_membro(uuid, uuid, uuid) TO authenticated;
