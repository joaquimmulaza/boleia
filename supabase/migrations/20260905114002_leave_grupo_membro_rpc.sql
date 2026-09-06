-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905114002 leave_grupo_membro_rpc
-- Do not rename; Supabase Preview CI requires exact version match.

-- P0: self leave de membros_grupo (activo→saiu) via SECURITY DEFINER.
-- RLS membros_update_self_reabrir_pendente só permite reabrir como pendente;
-- membros_update_owner não cobre saída do próprio membro activo.
-- Não toca propostas (N_proposto imutável). Não reabre UPDATE client genérico.

CREATE OR REPLACE FUNCTION public.leave_grupo_membro(
  p_grupo_id uuid,
  p_passenger_id uuid DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'grupo_id é obrigatório.';
  END IF;

  v_target := COALESCE(p_passenger_id, v_uid);

  -- Só o próprio membro pode sair por esta RPC (owner continua a gerir pedidos via RLS).
  IF v_uid IS DISTINCT FROM v_target THEN
    RAISE EXCEPTION 'Só podes sair do grupo por ti próprio.';
  END IF;

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

  IF v_n_activos <= 1 THEN
    RAISE EXCEPTION 'Não podes sair: és o único membro activo do grupo.';
  END IF;

  UPDATE public.membros_grupo
  SET estado = 'saiu'
  WHERE id = v_membro.id
  RETURNING * INTO v_membro;

  SELECT procura_id INTO v_procura_id
  FROM public.grupos
  WHERE id = p_grupo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo não encontrado.';
  END IF;

  SELECT COUNT(*)::integer INTO v_n_activos
  FROM public.membros_grupo
  WHERE grupo_id = p_grupo_id
    AND lower(estado) = 'activo';

  IF v_n_activos < 1 THEN
    RAISE EXCEPTION 'O grupo precisa de pelo menos 1 membro activo.';
  END IF;

  -- Sync N_actual (n_candidato). Não invalida nem muta propostas.
  UPDATE public.procuras
  SET
    n_candidato = v_n_activos,
    updated_at = now()
  WHERE id = v_procura_id;

  RETURN v_membro;
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_grupo_membro(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_grupo_membro(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_grupo_membro(uuid, uuid) TO service_role;
