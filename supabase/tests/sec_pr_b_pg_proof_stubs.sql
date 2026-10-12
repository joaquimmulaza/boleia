-- Stubs pós-migrações para prova Security PR B (Vault vazio + log pg_net)
\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS vault;
DROP VIEW IF EXISTS vault.decrypted_secrets;
CREATE VIEW vault.decrypted_secrets AS
SELECT NULL::text AS name, NULL::text AS decrypted_secret
WHERE false;

CREATE TABLE IF NOT EXISTS public._sec_pr_b_net_log (
  id bigserial PRIMARY KEY,
  url text NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  called_at timestamptz NOT NULL DEFAULT now()
);

CREATE SCHEMA IF NOT EXISTS net;

CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  headers jsonb DEFAULT '{}'::jsonb,
  body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public._sec_pr_b_net_log (url, headers, body)
  VALUES (url, headers, body);
  RETURN 1;
END;
$$;
