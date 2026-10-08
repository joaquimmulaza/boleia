-- Smoke #3a — item 10 hotfix: QA vê marketplace teste; participantes mantêm acesso em joins.

CREATE OR REPLACE FUNCTION public.viewer_is_qa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_qa_test_owner_email(
    (SELECT u.email FROM auth.users u WHERE u.id = auth.uid())
  );
$$;

REVOKE ALL ON FUNCTION public.viewer_is_qa() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.viewer_is_qa() FROM anon;
GRANT EXECUTE ON FUNCTION public.viewer_is_qa() TO authenticated;

DROP POLICY IF EXISTS ofertas_select_autenticados ON public.ofertas_capacidade;
CREATE POLICY ofertas_select_autenticados ON public.ofertas_capacidade
  FOR SELECT TO authenticated
  USING (
    NOT is_test
    OR driver_id = auth.uid()
    OR (SELECT public.viewer_is_qa())
    OR EXISTS (
      SELECT 1
      FROM public.acordos a
      LEFT JOIN public.acordos_passageiros ap ON ap.acordo_id = a.id
      WHERE a.oferta_id = ofertas_capacidade.id
        AND (a.driver_id = auth.uid() OR ap.passenger_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.propostas pr
      LEFT JOIN public.procuras pc ON pc.id = pr.procura_id
      WHERE pr.oferta_id = ofertas_capacidade.id
        AND (pr.created_by = auth.uid() OR pc.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS procuras_select_autenticados ON public.procuras;
CREATE POLICY procuras_select_autenticados ON public.procuras
  FOR SELECT TO authenticated
  USING (
    NOT is_test
    OR owner_id = auth.uid()
    OR (SELECT public.viewer_is_qa())
    OR EXISTS (
      SELECT 1
      FROM public.propostas pr
      LEFT JOIN public.ofertas_capacidade o ON o.id = pr.oferta_id
      WHERE pr.procura_id = procuras.id
        AND (pr.created_by = auth.uid() OR o.driver_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1
      FROM public.grupos g
      JOIN public.membros_grupo mg ON mg.grupo_id = g.id
      WHERE g.procura_id = procuras.id
        AND mg.passenger_id = auth.uid()
    )
  );
