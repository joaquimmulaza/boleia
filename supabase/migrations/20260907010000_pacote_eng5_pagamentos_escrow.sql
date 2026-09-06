-- PACOTE ENG #5 — pagamentos escrow, storage comprovativos, IBAN motorista, admin gate contactos
-- Valores sempre de quota_mensal_kz (acordo); take-rate ~10% documentado no payout líquido.

-- === perfis: IBAN motorista + flag admin ===
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS iban_titular text,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- === payout líquido (take-rate default 10%) ===
CREATE OR REPLACE FUNCTION public.compute_payout_liquido_kz(
  p_valor integer,
  p_take_rate numeric DEFAULT 0.10
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT floor(GREATEST(p_valor, 0) * (1 - GREATEST(p_take_rate, 0)))::integer;
$$;

-- === pagamentos por lugar (acordos_passageiros) ===
CREATE TABLE IF NOT EXISTS public.pagamentos_acordo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  acordo_passageiro_id uuid NOT NULL UNIQUE REFERENCES public.acordos_passageiros(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  valor_kz integer NOT NULL CHECK (valor_kz >= 0),
  take_rate_pct numeric(5,4) NOT NULL DEFAULT 0.10 CHECK (take_rate_pct >= 0 AND take_rate_pct < 1),
  valor_payout_liquido_kz integer NOT NULL CHECK (valor_payout_liquido_kz >= 0),
  estado text NOT NULL DEFAULT 'pendente_pagamento'
    CHECK (estado IN (
      'pendente_pagamento',
      'comprovativo_enviado',
      'em_custodia',
      'liquidado',
      'reembolsado'
    )),
  comprovativo_path text,
  comprovativo_enviado_em timestamptz,
  mes_referencia date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  validado_por uuid REFERENCES public.perfis(id),
  validado_em timestamptz,
  rejeicao_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagamentos_acordo_acordo_id ON public.pagamentos_acordo (acordo_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_acordo_passenger_id ON public.pagamentos_acordo (passenger_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_acordo_estado ON public.pagamentos_acordo (estado);

ALTER TABLE public.pagamentos_acordo ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.perfis WHERE id = auth.uid()),
    false
  );
$$;

-- Trigger: criar pagamento ao inserir passageiro activo no acordo (valor = quota congelada)
CREATE OR REPLACE FUNCTION public.trg_acordos_passageiros_create_pagamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_driver_id uuid;
  v_take_rate numeric := 0.10;
BEGIN
  IF lower(COALESCE(NEW.estado, '')) <> 'activo' THEN
    RETURN NEW;
  END IF;

  SELECT driver_id INTO v_driver_id
  FROM public.acordos
  WHERE id = NEW.acordo_id;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Acordo não encontrado para pagamento.';
  END IF;

  INSERT INTO public.pagamentos_acordo (
    acordo_id,
    acordo_passageiro_id,
    passenger_id,
    driver_id,
    valor_kz,
    take_rate_pct,
    valor_payout_liquido_kz,
    mes_referencia
  ) VALUES (
    NEW.acordo_id,
    NEW.id,
    NEW.passenger_id,
    v_driver_id,
    NEW.quota_mensal_kz,
    v_take_rate,
    public.compute_payout_liquido_kz(NEW.quota_mensal_kz, v_take_rate),
    date_trunc('month', CURRENT_DATE)::date
  )
  ON CONFLICT (acordo_passageiro_id) DO NOTHING;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS acordos_passageiros_create_pagamento ON public.acordos_passageiros;
CREATE TRIGGER acordos_passageiros_create_pagamento
  AFTER INSERT ON public.acordos_passageiros
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_acordos_passageiros_create_pagamento();

-- === RLS pagamentos_acordo ===
DROP POLICY IF EXISTS pagamentos_select_participantes ON public.pagamentos_acordo;
CREATE POLICY pagamentos_select_participantes ON public.pagamentos_acordo
  FOR SELECT TO authenticated
  USING (
    auth.uid() = passenger_id
    OR auth.uid() = driver_id
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS pagamentos_update_admin ON public.pagamentos_acordo;
CREATE POLICY pagamentos_update_admin ON public.pagamentos_acordo
  FOR UPDATE TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Inserts só via trigger SECURITY DEFINER; sem INSERT client directo

-- === RPC: submit_payment_proof ===
CREATE OR REPLACE FUNCTION public.submit_payment_proof(
  p_pagamento_id uuid,
  p_storage_path text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF p_pagamento_id IS NULL OR p_storage_path IS NULL OR length(trim(p_storage_path)) = 0 THEN
    RAISE EXCEPTION 'Pagamento e comprovativo são obrigatórios.';
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF v_uid IS DISTINCT FROM v_row.passenger_id THEN
    RAISE EXCEPTION 'Só o passageiro pode enviar comprovativo.';
  END IF;

  IF lower(v_row.estado) NOT IN ('pendente_pagamento', 'comprovativo_enviado') THEN
    RAISE EXCEPTION 'Este pagamento não aceita comprovativo neste estado.';
  END IF;

  IF p_storage_path NOT LIKE (v_uid::text || '/%') THEN
    RAISE EXCEPTION 'Caminho de comprovativo inválido.';
  END IF;

  UPDATE public.pagamentos_acordo
  SET
    comprovativo_path = p_storage_path,
    comprovativo_enviado_em = now(),
    estado = 'comprovativo_enviado',
    rejeicao_motivo = NULL,
    updated_at = now()
  WHERE id = p_pagamento_id;

  RETURN p_pagamento_id;
END;
$function$;

-- === RPC: admin_validate_payment ===
CREATE OR REPLACE FUNCTION public.admin_validate_payment(
  p_pagamento_id uuid,
  p_aprovar boolean,
  p_motivo text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.pagamentos_acordo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso reservado a administradores.';
  END IF;

  SELECT * INTO v_row
  FROM public.pagamentos_acordo
  WHERE id = p_pagamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento não encontrado.';
  END IF;

  IF lower(v_row.estado) <> 'comprovativo_enviado' THEN
    RAISE EXCEPTION 'Só comprovativos enviados podem ser validados.';
  END IF;

  IF p_aprovar THEN
    UPDATE public.pagamentos_acordo
    SET
      estado = 'em_custodia',
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULL,
      updated_at = now()
    WHERE id = p_pagamento_id;
  ELSE
    UPDATE public.pagamentos_acordo
    SET
      estado = 'pendente_pagamento',
      comprovativo_path = NULL,
      comprovativo_enviado_em = NULL,
      validado_por = v_uid,
      validado_em = now(),
      rejeicao_motivo = NULLIF(trim(p_motivo), ''),
      updated_at = now()
    WHERE id = p_pagamento_id;
  END IF;

  RETURN p_pagamento_id;
END;
$function$;

-- === RPC: get_acordo_contactos (hard-gate) ===
CREATE OR REPLACE FUNCTION public.get_acordo_contactos(p_acordo_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_acordo public.acordos%ROWTYPE;
  v_is_driver boolean;
  v_is_passenger boolean;
  v_my_pagamento public.pagamentos_acordo%ROWTYPE;
  v_motorista jsonb;
  v_passageiros jsonb := '[]'::jsonb;
  v_row record;
  v_bloqueado boolean := true;
BEGIN
  IF v_uid IS NULL OR p_acordo_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  SELECT * INTO v_acordo FROM public.acordos WHERE id = p_acordo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acordo não encontrado.';
  END IF;

  v_is_driver := v_uid = v_acordo.driver_id;
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id
      AND ap.passenger_id = v_uid
      AND lower(ap.estado) = 'activo'
  ) INTO v_is_passenger;

  IF NOT v_is_driver AND NOT v_is_passenger AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Sem permissão para ver contactos deste acordo.';
  END IF;

  IF v_is_passenger THEN
    SELECT * INTO v_my_pagamento
    FROM public.pagamentos_acordo
    WHERE acordo_id = p_acordo_id AND passenger_id = v_uid
    ORDER BY created_at DESC
    LIMIT 1;

    IF FOUND AND lower(v_my_pagamento.estado) IN ('em_custodia', 'liquidado') THEN
      v_bloqueado := false;
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'nome_completo', p.nome_completo,
    'telefone', CASE
      WHEN v_is_passenger AND NOT v_bloqueado THEN p.telefone
      WHEN v_is_driver THEN NULL
      ELSE NULL
    END
  ) INTO v_motorista
  FROM public.perfis p
  WHERE p.id = v_acordo.driver_id;

  FOR v_row IN
    SELECT ap.passenger_id, pf.nome_completo, pf.telefone, pg.estado AS pagamento_estado
    FROM public.acordos_passageiros ap
    JOIN public.perfis pf ON pf.id = ap.passenger_id
    LEFT JOIN public.pagamentos_acordo pg ON pg.acordo_passageiro_id = ap.id
    WHERE ap.acordo_id = p_acordo_id
      AND lower(ap.estado) = 'activo'
    ORDER BY ap.ordem_insercao ASC
  LOOP
    v_passageiros := v_passageiros || jsonb_build_array(jsonb_build_object(
      'passenger_id', v_row.passenger_id,
      'nome_completo', v_row.nome_completo,
      'telefone', CASE
        WHEN v_is_driver AND lower(COALESCE(v_row.pagamento_estado, '')) IN ('em_custodia', 'liquidado')
          THEN v_row.telefone
        WHEN v_is_passenger AND v_row.passenger_id = v_uid AND NOT v_bloqueado
          THEN v_row.telefone
        ELSE NULL
      END
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'bloqueado', CASE
      WHEN v_is_passenger THEN v_bloqueado
      WHEN v_is_driver THEN NOT EXISTS (
        SELECT 1 FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND lower(pg.estado) IN ('em_custodia', 'liquidado')
      )
      ELSE false
    END,
    'motivo', CASE
      WHEN v_is_passenger AND v_bloqueado THEN 'Confirma o pagamento e aguarda validação para ver contactos.'
      WHEN v_is_driver AND NOT EXISTS (
        SELECT 1 FROM public.pagamentos_acordo pg
        WHERE pg.acordo_id = p_acordo_id
          AND lower(pg.estado) IN ('em_custodia', 'liquidado')
      ) THEN 'Contactos disponíveis após pagamento em custódia.'
      ELSE NULL
    END,
    'motorista', v_motorista,
    'passageiros', v_passageiros
  );
END;
$function$;

-- === Storage bucket privado ===
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'comprovativos-pagamento',
  'comprovativos-pagamento',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS comprovativos_insert_own ON storage.objects;
CREATE POLICY comprovativos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovativos-pagamento'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS comprovativos_select_own_or_admin ON storage.objects;
CREATE POLICY comprovativos_select_own_or_admin ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovativos-pagamento'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin()
    )
  );

DROP POLICY IF EXISTS comprovativos_update_own ON storage.objects;
CREATE POLICY comprovativos_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'comprovativos-pagamento'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'comprovativos-pagamento'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Grants RPC (authenticated only; anon revogado noutras migrações)
GRANT EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_validate_payment(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_acordo_contactos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_payout_liquido_kz(integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_payment_proof(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_validate_payment(uuid, boolean, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_acordo_contactos(uuid) FROM anon;
