-- Overrides auth.* só para prova PG P0 (#246). Carregar após bootstrap_local_supabase.sql.
\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      WHERE NULLIF(current_setting('request.jwt.claims', true), '') IS NOT NULL
    ),
    NULLIF(current_setting('request.jwt.claim.sub', true), '')
  )::uuid;
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
