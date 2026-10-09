-- fix(sec): column grants em perfis/notificacoes; revogar EXECUTE de helpers internos.
-- Auditoria: boleia-rls-update-audit-2026-10-09 (item #1 perfis.is_admin, #2 RPCs internas).
-- Não alterar default ACL de postgres: tabelas históricas (pagamentos_acordo, etc.) dependem dos defaults.

-- === 1. perfis: UPDATE só colunas que o cliente escreve (rg src/ + supabase/functions) ===
-- useAuthForm.js: nome_completo, telefone, tipo_perfil, perfil_completo
-- OnboardingPermissions.jsx: onboarding_completed
-- ProfileService / Profile.jsx: nome_completo, telefone, iban, iban_titular
-- INSERT em perfis: apenas trigger SECURITY DEFINER handle_new_user (auth.users) — não o cliente.

REVOKE UPDATE ON TABLE public.perfis FROM authenticated, anon;

GRANT UPDATE (
  nome_completo,
  telefone,
  iban,
  iban_titular,
  onboarding_completed,
  perfil_completo,
  tipo_perfil
) ON TABLE public.perfis TO authenticated;

-- === 2. Helpers internos: só invocadas por SECURITY DEFINER / triggers (rg: sem .rpc no cliente) ===
REVOKE EXECUTE ON FUNCTION public._liquidate_pagamento_row(public.pagamentos_acordo, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._create_pagamentos_periodo(uuid, date, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public._refresh_repasse_motorista(uuid, date, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.notify_domain_event(uuid, text, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;

-- === 3. notificacoes: cliente só actualiza lida (useNotifications.js) ===
REVOKE UPDATE ON TABLE public.notificacoes FROM authenticated, anon;

GRANT UPDATE (lida) ON TABLE public.notificacoes TO authenticated;
