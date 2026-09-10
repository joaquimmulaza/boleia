-- Default privileges do CREATE FUNCTION davam EXECUTE a authenticated.
-- Helpers não são API cliente; RPCs públicas ficam só authenticated.
REVOKE ALL ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM authenticated;
REVOKE ALL ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM authenticated;
REVOKE ALL ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.update_procura(
  uuid, time without time zone, text, numeric, numeric, text, numeric, numeric, integer, integer[]
) FROM anon;
REVOKE ALL ON FUNCTION public.cancel_procura(uuid) FROM anon;
