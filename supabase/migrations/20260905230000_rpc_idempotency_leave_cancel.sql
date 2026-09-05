-- Wave 3 PWA: idempotência MVP para leave_passenger + cancel_proposal

CREATE TABLE IF NOT EXISTS public.rpc_idempotency (
  idempotency_key uuid PRIMARY KEY,
  rpc_name text NOT NULL,
  subject_id uuid,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rpc_idempotency ENABLE ROW LEVEL SECURITY;

-- Sem políticas para authenticated: só SECURITY DEFINER escreve/lê.

DROP FUNCTION IF EXISTS public.leave_passenger(uuid, uuid);

CREATE OR REPLACE FUNCTION public.leave_passenger(
  p_acordo_id uuid,
  p_passenger_id uuid DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
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

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      RETURN p_acordo_id;
    END IF;
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

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'leave_passenger', p_acordo_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.leave_passenger(uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_passenger(uuid, uuid, uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.cancel_proposal(uuid);

CREATE OR REPLACE FUNCTION public.cancel_proposal(
  p_proposta_id uuid,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS public.propostas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prop public.propostas%ROWTYPE;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.rpc_idempotency WHERE idempotency_key = p_idempotency_key
    ) THEN
      SELECT * INTO v_prop FROM public.propostas WHERE id = p_proposta_id;
      IF FOUND THEN
        RETURN v_prop;
      END IF;
      -- Proposta em falta mas chave já usada: devolver stub mínimo
      v_prop.id := p_proposta_id;
      v_prop.estado := 'cancelada';
      RETURN v_prop;
    END IF;
  END IF;

  SELECT * INTO v_prop FROM public.propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada.';
  END IF;

  IF v_prop.estado <> 'aberta' THEN
    RAISE EXCEPTION 'Proposta não está aberta.';
  END IF;

  -- Só o criador cancela (contraparte usa reject_proposal)
  IF v_uid IS DISTINCT FROM v_prop.created_by THEN
    RAISE EXCEPTION 'Só o criador pode cancelar esta proposta.';
  END IF;

  UPDATE public.propostas
  SET estado = 'cancelada', updated_at = now()
  WHERE id = v_prop.id
  RETURNING * INTO v_prop;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'cancel_proposal', p_proposta_id, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_prop;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_proposal(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_proposal(uuid, uuid) TO authenticated;
