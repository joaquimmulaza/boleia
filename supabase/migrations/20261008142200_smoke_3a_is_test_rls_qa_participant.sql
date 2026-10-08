-- Smoke #3a — item 10 hotfix: QA vê marketplace teste; participantes sem recursão RLS (42P17).

CREATE OR REPLACE FUNCTION public.viewer_is_qa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.qa_accounts q
    WHERE q.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.viewer_is_qa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_is_qa() FROM anon;
GRANT EXECUTE ON FUNCTION public.viewer_is_qa() TO authenticated;

CREATE OR REPLACE FUNCTION public.viewer_is_oferta_participant(p_oferta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.acordos a
    WHERE a.oferta_id = p_oferta_id
      AND (
        a.driver_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.acordos_passageiros ap
          WHERE ap.acordo_id = a.id
            AND ap.passenger_id = auth.uid()
        )
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.propostas pr
    WHERE pr.oferta_id = p_oferta_id
      AND (
        pr.created_by = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.procuras pc
          WHERE pc.id = pr.procura_id
            AND pc.owner_id = auth.uid()
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.viewer_is_procura_participant(p_procura_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.propostas pr
    INNER JOIN public.ofertas_capacidade o ON o.id = pr.oferta_id
    WHERE pr.procura_id = p_procura_id
      AND (pr.created_by = auth.uid() OR o.driver_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1
    FROM public.grupos g
    INNER JOIN public.membros_grupo mg ON mg.grupo_id = g.id
    WHERE g.procura_id = p_procura_id
      AND mg.passenger_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.viewer_is_oferta_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_is_oferta_participant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.viewer_is_oferta_participant(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.viewer_is_procura_participant(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_is_procura_participant(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.viewer_is_procura_participant(uuid) TO authenticated;

DROP POLICY IF EXISTS ofertas_select_autenticados ON public.ofertas_capacidade;
CREATE POLICY ofertas_select_autenticados ON public.ofertas_capacidade
  FOR SELECT TO authenticated
  USING (
    NOT is_test
    OR driver_id = auth.uid()
    OR (SELECT public.viewer_is_qa())
    OR (is_test AND public.viewer_is_oferta_participant(id))
  );

DROP POLICY IF EXISTS procuras_select_autenticados ON public.procuras;
CREATE POLICY procuras_select_autenticados ON public.procuras
  FOR SELECT TO authenticated
  USING (
    NOT is_test
    OR owner_id = auth.uid()
    OR (SELECT public.viewer_is_qa())
    OR (is_test AND public.viewer_is_procura_participant(id))
  );
