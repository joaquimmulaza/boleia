-- Bootstrap mínimo Supabase-like para aplicar migrações locais (prova PG).
\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION extensions.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
AS $$ SELECT gen_random_uuid(); $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT authenticated TO postgres;
GRANT anon TO postgres;
GRANT service_role TO postgres;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role, postgres;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    (
      SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
      WHERE NULLIF(current_setting('request.jwt.claims', true), '') IS NOT NULL
    ),
    'anon'
  );
$$;

CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT string_to_array(name, '/');
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid,
  owner_id text
);

-- pg_net stub (remote_schema cria extensão real; falha sem package — ignorar se existir)
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_net indisponível — skip (%)', SQLERRM;
END $$;
