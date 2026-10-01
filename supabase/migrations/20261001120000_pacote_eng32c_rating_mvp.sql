-- PACOTE ENG #32c — rating MVP bilateral mot↔pax (M1 primeiro período + M2 saída)
-- Comentário platform-only; contraparte vê no máximo «avaliado» via RPC dedicada.

CREATE TABLE IF NOT EXISTS public.avaliacoes_acordo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  acordo_passageiro_id uuid NOT NULL REFERENCES public.acordos_passageiros(id) ON DELETE CASCADE,
  avaliador_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  avaliado_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  direccao text NOT NULL
    CHECK (direccao IN ('passageiro_para_motorista', 'motorista_para_passageiro')),
  momento text NOT NULL
    CHECK (momento IN ('primeiro_periodo', 'saida')),
  estrelas smallint NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
  comentario text,
  mes_referencia date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT avaliacoes_acordo_unique_par_momento
    UNIQUE (acordo_passageiro_id, avaliador_id, momento)
);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_acordo_acordo_id
  ON public.avaliacoes_acordo (acordo_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_acordo_avaliador_id
  ON public.avaliacoes_acordo (avaliador_id);
CREATE INDEX IF NOT EXISTS idx_avaliacoes_acordo_avaliado_id
  ON public.avaliacoes_acordo (avaliado_id);

ALTER TABLE public.avaliacoes_acordo ENABLE ROW LEVEL SECURITY;

-- Avaliador vê a própria submissão (inclui comentário).
CREATE POLICY avaliacoes_select_own ON public.avaliacoes_acordo
  FOR SELECT TO authenticated
  USING (avaliador_id = auth.uid());

-- Admin vê tudo (moderação interna).
CREATE POLICY avaliacoes_select_admin ON public.avaliacoes_acordo
  FOR SELECT TO authenticated
  USING (public.is_platform_admin());

-- Sem INSERT/UPDATE/DELETE directo — só RPC.
REVOKE INSERT, UPDATE, DELETE ON public.avaliacoes_acordo FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public._rating_periodo_liquidado(p_estado text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(COALESCE(p_estado, '')) IN ('em_custodia', 'liquidado');
$$;

CREATE OR REPLACE FUNCTION public._rating_first_settled_at(p_acordo_passageiro_id uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    MIN(COALESCE(p.liquidado_em, p.validado_em)),
    NULL
  )
  FROM public.pagamentos_acordo p
  WHERE p.acordo_passageiro_id = p_acordo_passageiro_id
    AND public._rating_periodo_liquidado(p.estado);
$$;

CREATE OR REPLACE FUNCTION public._rating_window_expires_at(p_start timestamptz)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_start IS NULL THEN NULL
    ELSE p_start + interval '14 days'
  END;
$$;

CREATE OR REPLACE FUNCTION public.was_avaliado_por(
  p_acordo_passageiro_id uuid,
  p_momento text,
  p_direccao text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.acordos_passageiros%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row
  FROM public.acordos_passageiros
  WHERE id = p_acordo_passageiro_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Contraparte só vê booleano — nunca comentário/estrelas.
  IF v_uid = v_row.passenger_id THEN
    RETURN EXISTS (
      SELECT 1 FROM public.avaliacoes_acordo a
      WHERE a.acordo_passageiro_id = p_acordo_passageiro_id
        AND a.momento = p_momento
        AND a.direccao = 'motorista_para_passageiro'
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.acordos ac
    WHERE ac.id = v_row.acordo_id AND ac.driver_id = v_uid
  ) THEN
    RETURN EXISTS (
      SELECT 1 FROM public.avaliacoes_acordo a
      WHERE a.acordo_passageiro_id = p_acordo_passageiro_id
        AND a.momento = p_momento
        AND a.direccao = 'passageiro_para_motorista'
    );
  END IF;

  RETURN false;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_avaliacao_acordo(
  p_acordo_id uuid,
  p_acordo_passageiro_id uuid,
  p_momento text,
  p_estrelas integer,
  p_comentario text DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_row public.acordos_passageiros%ROWTYPE;
  v_direccao text;
  v_avaliado_id uuid;
  v_settled_at timestamptz;
  v_window_end timestamptz;
  v_mes date;
  v_existing uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_momento NOT IN ('primeiro_periodo', 'saida') THEN
    RAISE EXCEPTION 'Momento de avaliação inválido.';
  END IF;

  IF p_estrelas IS NULL OR p_estrelas < 1 OR p_estrelas > 5 THEN
    RAISE EXCEPTION 'Escolhe uma classificação entre 1 e 5 estrelas.';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT subject_id INTO v_existing
    FROM public.rpc_idempotency
    WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  SELECT * INTO v_row
  FROM public.acordos_passageiros
  WHERE id = p_acordo_passageiro_id AND acordo_id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lugar no acordo não encontrado.';
  END IF;

  v_settled_at := public._rating_first_settled_at(v_row.id);
  IF v_settled_at IS NULL THEN
    RAISE EXCEPTION 'Ainda não há período pago confirmado para avaliar.';
  END IF;

  IF lower(COALESCE(v_row.estado, '')) = 'expirado' THEN
    RAISE EXCEPTION 'Lugar expirado — não elegível para avaliação.';
  END IF;

  IF v_uid = v_row.passenger_id THEN
    v_direccao := 'passageiro_para_motorista';
    v_avaliado_id := v_acordo.driver_id;
    IF lower(COALESCE(v_row.estado, '')) NOT IN ('activo', 'saiu') THEN
      RAISE EXCEPTION 'Passageiro não elegível para avaliar.';
    END IF;
  ELSIF v_uid = v_acordo.driver_id THEN
    v_direccao := 'motorista_para_passageiro';
    v_avaliado_id := v_row.passenger_id;
    IF lower(COALESCE(v_row.estado, '')) NOT IN ('activo', 'saiu') THEN
      RAISE EXCEPTION 'Passageiro não elegível para ser avaliado.';
    END IF;
  ELSE
    RAISE EXCEPTION 'Sem permissão para avaliar neste acordo.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.avaliacoes_acordo a
    WHERE a.acordo_passageiro_id = p_acordo_passageiro_id
      AND a.avaliador_id = v_uid
      AND a.momento = p_momento
  ) THEN
    RAISE EXCEPTION 'Já submeteste esta avaliação.';
  END IF;

  IF p_momento = 'primeiro_periodo' THEN
    v_window_end := public._rating_window_expires_at(v_settled_at);
    IF now() > v_window_end THEN
      RAISE EXCEPTION 'A janela de avaliação expirou.';
    END IF;
    SELECT MIN(p.mes_referencia) INTO v_mes
    FROM public.pagamentos_acordo p
    WHERE p.acordo_passageiro_id = v_row.id
      AND public._rating_periodo_liquidado(p.estado);
  ELSE
    -- M2 saída: janela aberta se activo (pré-saída) ou até 14 dias após saída.
    IF lower(COALESCE(v_row.estado, '')) = 'activo' THEN
      v_window_end := NULL;
    ELSIF lower(COALESCE(v_row.estado, '')) = 'saiu' THEN
      v_window_end := public._rating_window_expires_at(v_row.updated_at);
      IF now() > v_window_end THEN
        RAISE EXCEPTION 'A janela de avaliação expirou.';
      END IF;
    ELSE
      RAISE EXCEPTION 'Momento de saída não aplicável.';
    END IF;
    v_mes := NULL;
  END IF;

  INSERT INTO public.avaliacoes_acordo (
    acordo_id,
    acordo_passageiro_id,
    avaliador_id,
    avaliado_id,
    direccao,
    momento,
    estrelas,
    comentario,
    mes_referencia
  ) VALUES (
    p_acordo_id,
    p_acordo_passageiro_id,
    v_uid,
    v_avaliado_id,
    v_direccao,
    p_momento,
    p_estrelas,
    NULLIF(trim(p_comentario), ''),
    v_mes
  )
  RETURNING id INTO v_existing;

  IF p_idempotency_key IS NOT NULL THEN
    INSERT INTO public.rpc_idempotency (idempotency_key, rpc_name, subject_id, user_id)
    VALUES (p_idempotency_key, 'submit_avaliacao_acordo', v_existing, v_uid)
    ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  RETURN v_existing;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_avaliacao_acordo(uuid, uuid, text, integer, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.was_avaliado_por(uuid, text, text) TO authenticated;
