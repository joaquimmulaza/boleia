-- Helpers de update_procura / cancel_procura não são API cliente.
REVOKE ALL ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM PUBLIC;

REVOKE ALL ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM anon;
REVOKE ALL ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM anon;
REVOKE ALL ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM anon;
REVOKE ALL ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM anon;
