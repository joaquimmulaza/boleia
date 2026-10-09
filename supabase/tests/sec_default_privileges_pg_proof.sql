-- Prova PostgreSQL: sec_default_privileges (20261009160000).
-- Requer roles Supabase-like (authenticated, anon, service_role).
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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, anon;

CREATE SCHEMA IF NOT EXISTS storage;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;

CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY,
  nome_completo text,
  telefone text,
  tipo_perfil text,
  perfil_completo boolean DEFAULT true,
  is_admin boolean DEFAULT false
);

-- Grants pré-fix (como remote_schema): authenticated tinha INSERT/DELETE
GRANT INSERT, DELETE, SELECT, UPDATE ON TABLE public.perfis TO authenticated;
GRANT SELECT ON TABLE public.perfis TO anon;

CREATE OR REPLACE FUNCTION public.trg_marketplace_is_test_oferta()
RETURNS trigger
LANGUAGE plpgsql
AS $$ BEGIN RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.trg_marketplace_is_test_procura()
RETURNS trigger
LANGUAGE plpgsql
AS $$ BEGIN RETURN NEW; END; $$;

GRANT EXECUTE ON FUNCTION public.trg_marketplace_is_test_oferta() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_marketplace_is_test_procura() TO PUBLIC;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis (id, nome_completo)
  VALUES (NEW.id, 'proof-user');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.perfis WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

CREATE OR REPLACE FUNCTION public.storage_comprovativo_pagamento_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public, storage
AS $$
DECLARE v_segment text;
BEGIN
  v_segment := NULLIF((storage.foldername(p_name))[2], '');
  IF v_segment IS NULL THEN RETURN NULL; END IF;
  IF v_segment !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN v_segment::uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.storage_comprovativo_pagamento_id(text) TO PUBLIC;

\i supabase/migrations/20261009160000_sec_default_privileges.sql

DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.perfis', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem INSERT em perfis';
  END IF;
  IF has_table_privilege('authenticated', 'public.perfis', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem DELETE em perfis';
  END IF;
  IF has_function_privilege('anon', 'public.trg_marketplace_is_test_oferta()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon pode EXECUTE trg_marketplace_is_test_oferta';
  END IF;
  IF has_function_privilege('authenticated', 'public.trg_marketplace_is_test_oferta()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated pode EXECUTE trg_marketplace_is_test_oferta';
  END IF;
END $$;

-- Simular signup (trigger path): SECURITY DEFINER insert
DO $$
DECLARE v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.perfis (id, nome_completo) VALUES (v_id, 'direct-sd');
  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = v_id) THEN
    RAISE EXCEPTION 'FAIL: perfis row missing after SD insert simulation';
  END IF;
END $$;

-- delete_own_account: precisa auth.uid() — só verificamos EXECUTE para authenticated
DO $$
BEGIN
  IF NOT has_function_privilege('authenticated', 'public.delete_own_account()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated perdeu EXECUTE delete_own_account';
  END IF;
  IF has_function_privilege('anon', 'public.delete_own_account()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon pode delete_own_account';
  END IF;
END $$;

-- Função nova pós-migração: defaults — authenticated sim, anon/PUBLIC não
CREATE OR REPLACE FUNCTION public._sec_default_priv_post_migration_probe()
RETURNS integer
LANGUAGE sql
AS $$ SELECT 1 $$;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public._sec_default_priv_post_migration_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon EXECUTE em função nova';
  END IF;
  IF has_function_privilege('PUBLIC', 'public._sec_default_priv_post_migration_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: PUBLIC EXECUTE em função nova';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public._sec_default_priv_post_migration_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated sem EXECUTE em função nova (default privileges)';
  END IF;
END $$;

-- UUID case-insensitive
DO $$
DECLARE v uuid;
BEGIN
  v := public.storage_comprovativo_pagamento_id(
    'uid/' || upper('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') || '/file.pdf'
  );
  IF v IS NULL THEN
    RAISE EXCEPTION 'FAIL: storage_comprovativo_pagamento_id não aceita UUID maiúsculo';
  END IF;
END $$;

DROP FUNCTION IF EXISTS public._sec_default_priv_post_migration_probe();

\echo 'OK: sec_default_privileges_pg_proof'
