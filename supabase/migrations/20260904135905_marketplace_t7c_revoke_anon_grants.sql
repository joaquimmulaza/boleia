-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904135905 marketplace_t7c_revoke_anon_grants
-- Do not rename; Supabase Preview CI requires exact version match.

-- Hardening: anon não deve ler domínio marketplace nem executar RPCs/triggers
REVOKE ALL ON TABLE public.ofertas_capacidade FROM anon;
REVOKE ALL ON TABLE public.procuras FROM anon;
REVOKE ALL ON TABLE public.grupos FROM anon;
REVOKE ALL ON TABLE public.membros_grupo FROM anon;
REVOKE ALL ON TABLE public.propostas FROM anon;
REVOKE ALL ON TABLE public.lista_espera FROM anon;
REVOKE ALL ON TABLE public.acordos FROM anon;
REVOKE ALL ON TABLE public.acordos_passageiros FROM anon;
REVOKE ALL ON TABLE public.faltas FROM anon;

REVOKE EXECUTE ON FUNCTION public.accept_proposal(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_proposal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_proposal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_proposal(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.handle_acordo_notifications() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_acordo_notifications() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_falta_desconto() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_falta_desconto() FROM PUBLIC;
