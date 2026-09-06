-- Reconciled from remote supabase_migrations.schema_migrations (project fdclrbcgytnuqcrpsevw)
-- Source: production migration history sync — 20260904135523 marketplace_t4_drop_legacy_domain
-- Do not rename; Supabase Preview CI requires exact version match.

-- T4: DROP domínio legado routes↔acordos 1:1
-- PRESERVE: perfis, handle_new_user, notificacoes, push_subscriptions, handle_new_notification_push, veiculos (estrutura base)

-- Remover triggers que dependem do schema antigo
DROP TRIGGER IF EXISTS on_falta_calc_desconto ON public.faltas;
DROP TRIGGER IF EXISTS trigger_acordos_notifications ON public.acordos;

-- Dados de teste + tabelas do domínio antigo (faltas → acordos → routes)
DROP TABLE IF EXISTS public.faltas CASCADE;
DROP TABLE IF EXISTS public.acordos CASCADE;
DROP TABLE IF EXISTS public.routes CASCADE;

-- RPCs e funções legadas (NÃO tocar handle_new_user / handle_new_notification_push)
DROP FUNCTION IF EXISTS public.decrement_available_seats(uuid);
DROP FUNCTION IF EXISTS public.increment_available_seats(uuid);
DROP FUNCTION IF EXISTS public.handle_acordo_notifications();
DROP FUNCTION IF EXISTS public.handle_falta_desconto();
