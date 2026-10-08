-- Smoke #3a — prova local PostgreSQL: policies is_test sem recursão 42P17 + qa_accounts allowlist.
\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text NOT NULL
);

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
GRANT USAGE ON SCHEMA auth TO authenticated, anon;

CREATE TABLE public.ofertas_capacidade (
  id uuid PRIMARY KEY,
  driver_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'disponivel',
  is_test boolean NOT NULL DEFAULT false
);

CREATE TABLE public.procuras (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'activa',
  is_test boolean NOT NULL DEFAULT false
);

CREATE TABLE public.grupos (
  id uuid PRIMARY KEY,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE
);

CREATE TABLE public.membros_grupo (
  id uuid PRIMARY KEY,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL
);

CREATE TABLE public.propostas (
  id uuid PRIMARY KEY,
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE CASCADE,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE,
  created_by uuid NOT NULL
);

CREATE TABLE public.acordos (
  id uuid PRIMARY KEY,
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE RESTRICT,
  driver_id uuid NOT NULL
);

CREATE TABLE public.acordos_passageiros (
  id uuid PRIMARY KEY,
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL
);

ALTER TABLE public.ofertas_capacidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procuras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos_passageiros ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ofertas_capacidade FORCE ROW LEVEL SECURITY;
ALTER TABLE public.procuras FORCE ROW LEVEL SECURITY;
ALTER TABLE public.grupos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo FORCE ROW LEVEL SECURITY;
ALTER TABLE public.propostas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.acordos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.acordos_passageiros FORCE ROW LEVEL SECURITY;

GRANT authenticated TO postgres;

CREATE OR REPLACE FUNCTION public.is_acordo_driver(p_acordo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.acordos a
    WHERE a.id = p_acordo_id AND a.driver_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_acordo_passenger(p_acordo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.acordos_passageiros ap
    WHERE ap.acordo_id = p_acordo_id AND ap.passenger_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_acordo_driver(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_acordo_passenger(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_acordo_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_acordo_passenger(uuid) TO authenticated;

CREATE POLICY propostas_select_envolvidos ON public.propostas
  FOR SELECT TO authenticated USING (
    auth.uid() = created_by
    OR auth.uid() = (SELECT o.driver_id FROM public.ofertas_capacidade o WHERE o.id = oferta_id)
    OR auth.uid() = (SELECT p.owner_id FROM public.procuras p WHERE p.id = procura_id)
  );

CREATE POLICY acordos_select_envolvidos ON public.acordos
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id OR public.is_acordo_passenger(id));

CREATE POLICY acordos_passageiros_select_envolvidos ON public.acordos_passageiros
  FOR SELECT TO authenticated
  USING (auth.uid() = passenger_id OR public.is_acordo_driver(acordo_id));

CREATE POLICY membros_select_autenticados ON public.membros_grupo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY ofertas_select_autenticados ON public.ofertas_capacidade
  FOR SELECT TO authenticated USING (true);

CREATE POLICY procuras_select_autenticados ON public.procuras
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Utilizadores antes do seed das migrations
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'critiquito.qa@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'motorista.real@gmail.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'passageiro.real@gmail.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dono.procura@gmail.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'visitante.real@gmail.com');

\i supabase/migrations/20261008142100_smoke_3a_is_test_flag.sql
\i supabase/migrations/20261008142200_smoke_3a_is_test_rls_qa_participant.sql

-- Registo pós-migration: padrão critiquito.* mas FORA da allowlist (não existia no snapshot)
INSERT INTO auth.users (id, email) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'critiquito.x@gmail.com');

-- Dados marketplace
INSERT INTO public.ofertas_capacidade (id, driver_id, estado, is_test) VALUES
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'disponivel', false),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'disponivel', true);

INSERT INTO public.procuras (id, owner_id, estado, is_test) VALUES
  ('33333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'activa', false),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'activa', true);

INSERT INTO public.propostas (id, oferta_id, procura_id, created_by) VALUES
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd');

INSERT INTO public.acordos (id, oferta_id, driver_id) VALUES
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id) VALUES
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

\echo '=== (a) SELECT ofertas/procuras como visitante real — sem 42P17 ==='
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
SET LOCAL ROLE authenticated;
SELECT 'ofertas' AS tabela, id, is_test FROM public.ofertas_capacidade ORDER BY id;
SELECT 'procuras' AS tabela, id, is_test FROM public.procuras ORDER BY id;
ROLLBACK;

\echo '=== (b) Visitante real sem relação com teste NÃO vê is_test ==='
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', true);
SET LOCAL ROLE authenticated;
SELECT
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.ofertas_capacidade WHERE is_test = true)
    AND NOT EXISTS (SELECT 1 FROM public.procuras WHERE is_test = true)
    THEN 'PASS: real user não vê is_test'
    ELSE 'FAIL: real user vê is_test'
  END AS resultado_b;
ROLLBACK;

\echo '=== (c) Conta QA allowlist vê is_test ==='
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SET LOCAL ROLE authenticated;
SELECT id, is_test FROM public.ofertas_capacidade WHERE is_test = true ORDER BY id;
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM public.ofertas_capacidade WHERE is_test = true)
    THEN 'PASS: QA allowlist vê ofertas is_test'
    ELSE 'FAIL: QA allowlist não vê is_test'
  END AS resultado_c;
ROLLBACK;

\echo '=== (d) Passageiro com acordo em oferta is_test vê essa oferta ==='
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'cccccccc-cccc-cccc-cccc-cccccccccccc', true);
SET LOCAL ROLE authenticated;
SELECT id, is_test FROM public.ofertas_capacidade ORDER BY id;
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.ofertas_capacidade
      WHERE id = '22222222-2222-2222-2222-222222222222'::uuid
    )
    THEN 'PASS: passageiro participante vê oferta is_test'
    ELSE 'FAIL: passageiro participante não vê oferta is_test'
  END AS resultado_d;
ROLLBACK;

\echo '=== (e) critiquito.x@gmail.com FORA da allowlist NÃO vê is_test ==='
SELECT
  CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.qa_accounts WHERE user_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid
    )
    THEN 'PASS: critiquito.x@gmail.com não está em qa_accounts'
    ELSE 'FAIL: critiquito.x@gmail.com está em qa_accounts'
  END AS precheck_e;

BEGIN;
SELECT set_config('request.jwt.claim.sub', 'ffffffff-ffff-ffff-ffff-ffffffffffff', true);
SET LOCAL ROLE authenticated;
SELECT
  CASE
    WHEN NOT (SELECT public.viewer_is_qa())
    AND NOT EXISTS (SELECT 1 FROM public.ofertas_capacidade WHERE is_test = true)
    AND NOT EXISTS (SELECT 1 FROM public.procuras WHERE is_test = true)
    THEN 'PASS: email critiquito.* fora da allowlist não vê is_test'
    ELSE 'FAIL: email critiquito.* fora da allowlist vê is_test'
  END AS resultado_e;
ROLLBACK;

\echo '=== FIM prova smoke_3a RLS ==='
