-- Browse marketplace público: anon pode ler ofertas/procuras activas (só SELECT).
-- Mutações e restantes tabelas continuam revogadas para anon.

GRANT SELECT ON TABLE public.ofertas_capacidade TO anon;
GRANT SELECT ON TABLE public.procuras TO anon;

DROP POLICY IF EXISTS ofertas_select_anon_browse ON public.ofertas_capacidade;
CREATE POLICY ofertas_select_anon_browse ON public.ofertas_capacidade
  FOR SELECT TO anon
  USING (estado IN ('disponivel', 'parcial'));

DROP POLICY IF EXISTS procuras_select_anon_browse ON public.procuras;
CREATE POLICY procuras_select_anon_browse ON public.procuras
  FOR SELECT TO anon
  USING (estado IN ('activa', 'em_negociacao'));
