-- cancel_procura: ao cancelar procura, o dono (passageiro) sai do grupo; fecha grupo sem activos.
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
  v_n_activos integer;
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
    UPDATE public.membros_grupo
    SET
      estado = 'saiu',
      saiu_em = v_now
    WHERE grupo_id = v_grupo_id
      AND passenger_id = v_uid
      AND lower(estado) = 'activo';

    SELECT COUNT(*)::integer INTO v_n_activos
    FROM public.membros_grupo
    WHERE grupo_id = v_grupo_id
      AND lower(estado) = 'activo';

    IF v_n_activos < 1 THEN
      UPDATE public.grupos
      SET estado = 'fechado'
      WHERE id = v_grupo_id;
    END IF;
  END IF;

  RETURN v_procura;
END;
$$;

-- Backfill: apenas dados is_test (procura cancelada + membros ainda activos)
WITH alvo AS (
  SELECT
    mg.id AS membro_id,
    g.id AS grupo_id,
    COALESCE(p.updated_at, p.created_at, now()) AS sai_at
  FROM public.membros_grupo mg
  INNER JOIN public.grupos g ON g.id = mg.grupo_id
  INNER JOIN public.procuras p ON p.id = g.procura_id
  WHERE p.is_test = true
    AND lower(p.estado) = 'cancelada'
    AND lower(mg.estado) = 'activo'
)
UPDATE public.membros_grupo mg
SET
  estado = 'saiu',
  saiu_em = alvo.sai_at
FROM alvo
WHERE mg.id = alvo.membro_id;

UPDATE public.grupos g
SET estado = 'fechado'
WHERE lower(COALESCE(g.estado, 'aberto')) <> 'fechado'
  AND EXISTS (
    SELECT 1
    FROM public.procuras p
    WHERE p.id = g.procura_id
      AND p.is_test = true
      AND lower(p.estado) = 'cancelada'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.membros_grupo mg
    WHERE mg.grupo_id = g.id
      AND lower(mg.estado) = 'activo'
  );

REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_procura(uuid) TO authenticated;
