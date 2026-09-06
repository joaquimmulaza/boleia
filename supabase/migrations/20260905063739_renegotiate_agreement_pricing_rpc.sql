-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260905063739 renegotiate_agreement_pricing_rpc
-- Do not rename; Supabase Preview CI requires exact version match.

-- T29: RPC adenda — único caminho SQL para mutar preços / n_passageiros_contrato
CREATE OR REPLACE FUNCTION public.renegotiate_agreement_pricing(
  p_acordo_id uuid,
  p_modo_preco text,
  p_valor_ask_kz integer,
  p_n_passageiros integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_uid uuid := auth.uid();
  v_n_activos integer;
  v_n integer;
  v_total integer;
  v_base integer;
  v_resto integer;
  v_quota integer;
  r record;
  i integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_modo_preco IS NULL OR p_valor_ask_kz IS NULL THEN
    RAISE EXCEPTION 'modo_preco e valor_ask_kz são obrigatórios.';
  END IF;

  IF p_valor_ask_kz < 0 THEN
    RAISE EXCEPTION 'Valor em Kz deve ser um inteiro não negativo.';
  END IF;

  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  IF lower(v_acordo.estado) <> 'activo' THEN
    RAISE EXCEPTION 'Acordo não está activo.';
  END IF;

  IF v_uid IS DISTINCT FROM v_acordo.driver_id THEN
    RAISE EXCEPTION 'Sem permissão para renegociar este acordo.';
  END IF;

  SELECT COALESCE(COUNT(*), 0)::integer INTO v_n_activos
  FROM public.acordos_passageiros
  WHERE acordo_id = p_acordo_id
    AND estado = 'activo';

  IF v_n_activos < 1 THEN
    RAISE EXCEPTION 'O acordo não tem passageiros activos.';
  END IF;

  v_n := COALESCE(p_n_passageiros, v_n_activos);

  -- MVP: N da adenda = COUNT activos (evita fantasmas / N > activos).
  IF v_n <> v_n_activos THEN
    RAISE EXCEPTION
      'n_passageiros (%) deve coincidir com o número de passageiros activos (%).',
      v_n, v_n_activos;
  END IF;

  IF p_modo_preco = 'POR_PASSAGEIRO' THEN
    v_base := p_valor_ask_kz;
    v_total := v_base * v_n;
    v_resto := 0;
  ELSIF p_modo_preco = 'TOTAL_ACORDO' THEN
    v_total := p_valor_ask_kz;
    v_base := v_total / v_n;
    v_resto := v_total % v_n;
  ELSE
    RAISE EXCEPTION 'Modo de preço desconhecido.';
  END IF;

  UPDATE public.acordos
  SET
    modo_preco = p_modo_preco,
    n_passageiros_contrato = v_n,
    valor_mensal_total_kz = v_total,
    valor_mensal_por_passageiro_kz = v_base
  WHERE id = p_acordo_id;

  FOR r IN
    SELECT id, passenger_id, ordem_insercao
    FROM public.acordos_passageiros
    WHERE acordo_id = p_acordo_id
      AND estado = 'activo'
    ORDER BY ordem_insercao ASC, passenger_id ASC
  LOOP
    IF p_modo_preco = 'POR_PASSAGEIRO' THEN
      v_quota := v_base;
    ELSE
      v_quota := CASE WHEN i < v_resto THEN v_base + 1 ELSE v_base END;
    END IF;

    UPDATE public.acordos_passageiros
    SET quota_mensal_kz = v_quota
    WHERE id = r.id;

    i := i + 1;
  END LOOP;

  -- Notificação best-effort aos activos (não falha a adenda se INSERT falhar).
  BEGIN
    INSERT INTO public.notificacoes (user_id, mensagem, tipo, metadata)
    SELECT
      ap.passenger_id,
      'O preço do acordo foi actualizado (adenda).',
      'success',
      jsonb_build_object('type', 'agreement_update', 'acordo_id', p_acordo_id)
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.estado = 'activo';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Falha ao notificar adenda do acordo %: %', p_acordo_id, SQLERRM;
  END;

  RETURN p_acordo_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.renegotiate_agreement_pricing(uuid, text, integer, integer) TO service_role;
