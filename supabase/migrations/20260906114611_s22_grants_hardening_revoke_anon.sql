-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260906114611 s22_grants_hardening_revoke_anon
-- Do not rename; Supabase Preview CI requires exact version match.

REVOKE ALL ON FUNCTION public.recalc_vagas_disponiveis() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalc_vagas_disponiveis() FROM anon;
REVOKE ALL ON FUNCTION public.oferta_ocupacao(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.recount_oferta_vagas(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.propose_agreement_adenda(uuid, text, integer, integer, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.terminate_agreement(uuid, text, text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.apply_due_agreement_terminations(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.oferta_ocupacao(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recount_oferta_vagas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_agreement_adenda(uuid, text, integer, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.terminate_agreement(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_due_agreement_terminations(uuid) TO authenticated;
