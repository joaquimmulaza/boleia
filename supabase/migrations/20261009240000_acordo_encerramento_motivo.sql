-- Acordo encerrado (último passageiro) vs cancelado (rescisão): encerramento_motivo distingue na UI.
-- Corpo base de _maybe_fechar_acordo_sem_lugares_vivos = prod / 20261009180000_p0_acordo_pagamento_estados.sql
-- (md5 pg_get_functiondef = 69166936f36f26c25b29b7b2033f8529) + SET encerramento_motivo.

ALTER TABLE public.acordos
  ADD COLUMN IF NOT EXISTS encerramento_motivo text;

ALTER TABLE public.acordos
  DROP CONSTRAINT IF EXISTS acordos_encerramento_motivo_check;

ALTER TABLE public.acordos
  ADD CONSTRAINT acordos_encerramento_motivo_check
  CHECK (encerramento_motivo IS NULL OR encerramento_motivo IN ('sem_lugares_vivos'));

COMMENT ON COLUMN public.acordos.encerramento_motivo IS
  'Quando estado=cancelado por fecho automático (sem lugares reservado/activo). Rescisões usam rescisao_modo.';

CREATE OR REPLACE FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(p_acordo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_acordo public.acordos%ROWTYPE;
  v_vivos integer;
BEGIN
  SELECT * INTO v_acordo
  FROM public.acordos
  WHERE id = p_acordo_id
  FOR UPDATE;

  IF NOT FOUND OR lower(v_acordo.estado) NOT IN ('activo', 'cancelamento_pendente') THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::integer INTO v_vivos
  FROM public.acordos_passageiros ap
  WHERE ap.acordo_id = p_acordo_id
    AND lower(ap.estado) IN ('activo', 'reservado');

  IF v_vivos = 0 THEN
    UPDATE public.acordos
    SET
      estado = 'cancelado',
      cancelado_em = COALESCE(cancelado_em, now()),
      encerramento_motivo = 'sem_lugares_vivos'
    WHERE id = p_acordo_id
      AND lower(estado) IN ('activo', 'cancelamento_pendente');
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._maybe_fechar_acordo_sem_lugares_vivos(uuid) TO service_role;

-- Backfill: só ofertas is_test (acordos não têm is_test; join oferta_id).
UPDATE public.acordos a
SET encerramento_motivo = 'sem_lugares_vivos'
FROM public.ofertas_capacidade o
WHERE a.oferta_id = o.id
  AND o.is_test = true
  AND lower(a.estado) = 'cancelado'
  AND a.rescisao_modo IS NULL
  AND a.encerramento_motivo IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = a.id
      AND lower(ap.estado) NOT IN ('saiu', 'expirado')
  );
