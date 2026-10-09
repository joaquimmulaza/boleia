-- Prova PostgreSQL: grants de coluna perfis/notificacoes + revoke EXECUTE helpers internos.
\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, anon;

-- Estado pré-fix (simula prod): UPDATE à tabela inteira
CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY,
  nome_completo text,
  telefone text,
  iban text,
  iban_titular text,
  onboarding_completed boolean DEFAULT false,
  perfil_completo boolean DEFAULT true,
  tipo_perfil text,
  is_admin boolean DEFAULT false,
  is_test boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mensagem text,
  tipo text,
  metadata jsonb DEFAULT '{}'::jsonb,
  lida boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.pagamentos_acordo (
  id uuid PRIMARY KEY,
  estado text,
  valor_payout_liquido_kz numeric
);

CREATE OR REPLACE FUNCTION public._liquidate_pagamento_row(
  p_row public.pagamentos_acordo,
  p_liquidado_por uuid
)
RETURNS jsonb
LANGUAGE sql
AS $$ SELECT '{}'::jsonb $$;

CREATE OR REPLACE FUNCTION public._create_pagamentos_periodo(
  p_acordo_id uuid,
  p_mes_referencia date,
  p_driver_id uuid
)
RETURNS integer
LANGUAGE sql
AS $$ SELECT 0 $$;

CREATE OR REPLACE FUNCTION public._refresh_repasse_motorista(
  p_driver_id uuid,
  p_mes date,
  p_liquidado_por uuid
)
RETURNS uuid
LANGUAGE sql
AS $$ SELECT NULL::uuid $$;

CREATE OR REPLACE FUNCTION public.notify_domain_event(
  p_user_id uuid,
  p_mensagem text,
  p_tipo text DEFAULT 'info',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_actor_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE sql
AS $$ SELECT $$;

GRANT UPDATE ON TABLE public.perfis TO authenticated;
GRANT UPDATE ON TABLE public.notificacoes TO authenticated;
GRANT EXECUTE ON FUNCTION public._liquidate_pagamento_row(public.pagamentos_acordo, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._create_pagamentos_periodo(uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public._refresh_repasse_motorista(uuid, date, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_domain_event(uuid, text, text, jsonb, uuid) TO authenticated;

\i supabase/migrations/20261009033000_sec_perfis_notificacoes_grants.sql

DO $$
DECLARE
  v_col text;
  v_legit text[] := ARRAY[
    'nome_completo', 'telefone', 'iban', 'iban_titular',
    'onboarding_completed', 'perfil_completo', 'tipo_perfil'
  ];
BEGIN
  IF has_column_privilege('authenticated', 'public.perfis', 'is_admin', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em perfis.is_admin';
  END IF;

  IF has_column_privilege('authenticated', 'public.perfis', 'is_test', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em perfis.is_test';
  END IF;

  FOREACH v_col IN ARRAY v_legit LOOP
    IF NOT has_column_privilege('authenticated', 'public.perfis', v_col, 'UPDATE') THEN
      RAISE EXCEPTION 'FAIL: falta GRANT UPDATE em perfis.%', v_col;
    END IF;
  END LOOP;

  IF has_function_privilege(
    'authenticated',
    'public._liquidate_pagamento_row(public.pagamentos_acordo, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda pode EXECUTE _liquidate_pagamento_row';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public._create_pagamentos_periodo(uuid, date, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda pode EXECUTE _create_pagamentos_periodo';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public._refresh_repasse_motorista(uuid, date, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda pode EXECUTE _refresh_repasse_motorista';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.notify_domain_event(uuid, text, text, jsonb, uuid)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda pode EXECUTE notify_domain_event';
  END IF;

  IF has_column_privilege('authenticated', 'public.notificacoes', 'mensagem', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em notificacoes.mensagem';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.notificacoes', 'lida', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: falta GRANT UPDATE em notificacoes.lida';
  END IF;

  RAISE NOTICE 'OK: sec_perfis_grants_pg_proof passou';
END $$;
