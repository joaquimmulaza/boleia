-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905111441 marketplace_p0_hardening_leave_rls
-- Do not rename; Supabase Preview CI requires exact version match.

-- P0 hardening: leave atómico + RLS sem bypass de RPC + membros sem auto-aprovação

CREATE OR REPLACE FUNCTION public.leave_passenger(
  p_acordo_id uuid,
  p_passenger_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_target uuid;
  v_acordo public.acordos%ROWTYPE;
  v_row public.acordos_passageiros%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_ocupadas integer;
  v_disponiveis integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'acordo_id é obrigatório.';
  END IF;

  v_target := COALESCE(p_passenger_id, v_uid);

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_target AND v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para sair deste acordo.';
  END IF;

  SELECT * INTO v_row
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND passenger_id = v_target
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Passageiro não pertence a este acordo.';
  END IF;

  IF lower(v_row.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Passageiro não está activo neste acordo.';
  END IF;

  UPDATE public.acordos_passageiros
  SET estado = 'saiu'
  WHERE id = v_row.id;

  -- Não mutar preços / n_passageiros_contrato / quotas dos restantes.

  SELECT * INTO v_oferta
  FROM public.ofertas_capacidade
  WHERE id = v_acordo.oferta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  SELECT COALESCE(COUNT(*), 0)::integer INTO v_ocupadas
  FROM public.acordos_passageiros ap
  JOIN public.acordos a ON a.id = ap.acordo_id
  WHERE a.oferta_id = v_oferta.id
    AND lower(a.estado) = 'activo'
    AND lower(ap.estado) = 'activo';

  v_disponiveis := GREATEST(0, v_oferta.vagas_totais - v_ocupadas);

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

  BEGIN
    PERFORM public.promote_waitlist(v_oferta.id);
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha best-effort promote_waitlist na saída do acordo %: %',
        p_acordo_id, SQLERRM;
  END;

  RETURN p_acordo_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid) TO authenticated;

-- Mutações de estado/preço só via RPC SECURITY DEFINER
DROP POLICY IF EXISTS propostas_update_envolvidos ON public.propostas;
DROP POLICY IF EXISTS acordos_update_envolvidos ON public.acordos;
DROP POLICY IF EXISTS acordos_passageiros_update_envolvidos ON public.acordos_passageiros;
DROP POLICY IF EXISTS lista_espera_update_envolvidos ON public.lista_espera;

-- Membros: owner gere; passageiro só reabre pedido como pendente (nunca activo)
DROP POLICY IF EXISTS membros_update_envolvidos ON public.membros_grupo;

CREATE POLICY membros_update_owner ON public.membros_grupo
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = (
      SELECT p.owner_id
      FROM public.grupos g
      JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = membros_grupo.grupo_id
    )
  )
  WITH CHECK (
    auth.uid() = (
      SELECT p.owner_id
      FROM public.grupos g
      JOIN public.procuras p ON p.id = g.procura_id
      WHERE g.id = membros_grupo.grupo_id
    )
  );

CREATE POLICY membros_update_self_reabrir_pendente ON public.membros_grupo
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = passenger_id
    AND lower(estado) IN ('rejeitado', 'saiu', 'pendente')
  )
  WITH CHECK (
    auth.uid() = passenger_id
    AND lower(estado) = 'pendente'
  );
