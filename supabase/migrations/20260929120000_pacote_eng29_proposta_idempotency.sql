-- PACOTE ENG #29 — Idempotência create_proposal (anti-duplicado aberta)

-- Mantém a proposta aberta mais antiga por (oferta, procura, iniciador); cancela duplicados legados.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY oferta_id, procura_id, created_by
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.propostas
  WHERE estado = 'aberta'
)
UPDATE public.propostas p
SET estado = 'cancelada', updated_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS propostas_aberta_iniciador_unique
  ON public.propostas (oferta_id, procura_id, created_by)
  WHERE estado = 'aberta';

CREATE OR REPLACE FUNCTION public.create_proposal(
  p_oferta_id uuid,
  p_procura_id uuid,
  p_grupo_id uuid,
  p_modo_preco text,
  p_valor_mensal_ask_kz integer,
  p_n_passageiros_propostos integer
)
RETURNS public.propostas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing public.propostas%ROWTYPE;
  v_oferta public.ofertas_capacidade%ROWTYPE;
  v_procura public.procuras%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_n_passageiros_propostos IS NULL OR p_n_passageiros_propostos < 1 THEN
    RAISE EXCEPTION 'Número de passageiros inválido.';
  END IF;

  IF p_n_passageiros_propostos > 1 AND p_grupo_id IS NULL THEN
    RAISE EXCEPTION 'Para propor com mais de uma pessoa é necessário um grupo ligado à procura.';
  END IF;

  IF p_modo_preco NOT IN ('POR_PASSAGEIRO', 'TOTAL_ACORDO') THEN
    RAISE EXCEPTION 'Modo de preço inválido.';
  END IF;

  IF p_valor_mensal_ask_kz IS NULL OR p_valor_mensal_ask_kz < 0 THEN
    RAISE EXCEPTION 'Valor mensal em Kz inválido.';
  END IF;

  SELECT * INTO v_oferta FROM public.ofertas_capacidade WHERE id = p_oferta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Oferta não encontrada.';
  END IF;

  SELECT * INTO v_procura FROM public.procuras WHERE id = p_procura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Procura não encontrada.';
  END IF;

  IF v_uid IS DISTINCT FROM v_oferta.driver_id AND v_uid IS DISTINCT FROM v_procura.owner_id THEN
    RAISE EXCEPTION 'Sem permissão para propor neste par oferta/procura.';
  END IF;

  SELECT * INTO v_existing
  FROM public.propostas
  WHERE oferta_id = p_oferta_id
    AND procura_id = p_procura_id
    AND created_by = v_uid
    AND estado = 'aberta'
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  BEGIN
    INSERT INTO public.propostas (
      oferta_id,
      procura_id,
      grupo_id,
      modo_preco,
      valor_mensal_ask_kz,
      n_passageiros_propostos,
      estado,
      created_by
    )
    VALUES (
      p_oferta_id,
      p_procura_id,
      p_grupo_id,
      p_modo_preco,
      p_valor_mensal_ask_kz,
      p_n_passageiros_propostos,
      'aberta',
      v_uid
    )
    RETURNING * INTO v_existing;

    RETURN v_existing;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT * INTO v_existing
      FROM public.propostas
      WHERE oferta_id = p_oferta_id
        AND procura_id = p_procura_id
        AND created_by = v_uid
        AND estado = 'aberta'
      LIMIT 1;

      IF NOT FOUND THEN
        RAISE;
      END IF;

      RETURN v_existing;
  END;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_proposal(uuid, uuid, uuid, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_proposal(uuid, uuid, uuid, text, integer, integer) TO authenticated;
