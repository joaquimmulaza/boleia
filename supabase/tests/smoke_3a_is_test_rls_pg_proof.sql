-- Smoke #3a — prova PostgreSQL: políticas prod verbatim + migrations #224 + asserções RAISE EXCEPTION.
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

CREATE TABLE auth.users (
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
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;
GRANT USAGE ON SCHEMA auth TO authenticated, anon, service_role;
GRANT authenticated TO postgres;

-- Stubs mínimos para migration 142000 (update_oferta) compilar
CREATE TABLE public.veiculos (
  id uuid PRIMARY KEY,
  vagas_passageiros integer NOT NULL DEFAULT 4
);

CREATE TABLE public.ofertas_capacidade (
  id uuid PRIMARY KEY,
  driver_id uuid NOT NULL,
  veiculo_id uuid REFERENCES public.veiculos(id),
  vagas_totais integer NOT NULL DEFAULT 4,
  vagas_disponiveis integer NOT NULL DEFAULT 4,
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  valor_mensal_ask_kz integer NOT NULL DEFAULT 0,
  flexibilidade_rota boolean NOT NULL DEFAULT false,
  origin_name text,
  destination_name text,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  departure_time time NOT NULL DEFAULT '08:00',
  return_time time,
  dias_semana integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  estado text NOT NULL DEFAULT 'disponivel',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.procuras (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL,
  preferred_time time NOT NULL DEFAULT '08:00',
  return_time time,
  estado text NOT NULL DEFAULT 'activa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.grupos (
  id uuid PRIMARY KEY,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE
);

CREATE TABLE public.membros_grupo (
  id uuid PRIMARY KEY,
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL,
  estado text NOT NULL DEFAULT 'activo'
);

CREATE TABLE public.propostas (
  id uuid PRIMARY KEY,
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE CASCADE,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE,
  grupo_id uuid REFERENCES public.grupos(id) ON DELETE SET NULL,
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  valor_mensal_ask_kz integer NOT NULL DEFAULT 0,
  n_passageiros_propostos integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'aberta',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lista_espera (
  id uuid PRIMARY KEY,
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE CASCADE,
  procura_id uuid NOT NULL REFERENCES public.procuras(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'activa'
);

CREATE TABLE public.acordos (
  id uuid PRIMARY KEY,
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id) ON DELETE RESTRICT,
  procura_id uuid REFERENCES public.procuras(id) ON DELETE SET NULL,
  driver_id uuid NOT NULL,
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  n_passageiros_contrato integer NOT NULL DEFAULT 1,
  valor_mensal_total_kz integer NOT NULL DEFAULT 0,
  valor_mensal_por_passageiro_kz integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'activo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.acordos_passageiros (
  id uuid PRIMARY KEY,
  acordo_id uuid NOT NULL REFERENCES public.acordos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL,
  quota_mensal_kz integer NOT NULL DEFAULT 0,
  ordem_insercao integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'activo',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.oferta_ocupacao(p_oferta_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$ SELECT 0; $$;

CREATE OR REPLACE FUNCTION public._assert_oferta_editavel(
  p_oferta public.ofertas_capacidade,
  p_uid uuid,
  p_cancel boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$ BEGIN NULL; END; $$;

CREATE OR REPLACE FUNCTION public.oferta_compativel_com_procura(
  p_oferta public.ofertas_capacidade,
  p_procura public.procuras
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$ SELECT true; $$;

CREATE OR REPLACE FUNCTION public._notify_proposta_contraparte_evento(
  p_prop public.propostas,
  p_tipo text,
  p_msg text
)
RETURNS void
LANGUAGE plpgsql
AS $$ BEGIN NULL; END; $$;

CREATE OR REPLACE FUNCTION public.recount_oferta_vagas(p_oferta_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$ BEGIN NULL; END; $$;

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

ALTER TABLE public.ofertas_capacidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.procuras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acordos_passageiros ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.ofertas_capacidade FORCE ROW LEVEL SECURITY;
ALTER TABLE public.procuras FORCE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo FORCE ROW LEVEL SECURITY;
ALTER TABLE public.propostas FORCE ROW LEVEL SECURITY;
ALTER TABLE public.acordos FORCE ROW LEVEL SECURITY;
ALTER TABLE public.acordos_passageiros FORCE ROW LEVEL SECURITY;

\i supabase/tests/fixtures/prod_policies_2026-10-08.sql

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Utilizadores existentes antes do seed (snapshot allowlist)
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'critiquito.qa@example.com'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'motorista.real@gmail.com'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'passageiro.real@gmail.com'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'dono.procura@gmail.com'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'visitante.real@gmail.com');

\i supabase/migrations/20261008142000_smoke_3a_oferta_vagas_stepper.sql
\i supabase/migrations/20261008142100_smoke_3a_is_test_flag.sql
\i supabase/migrations/20261008142200_smoke_3a_is_test_rls_qa_participant.sql

INSERT INTO auth.users (id, email) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'critiquito.x@gmail.com');

INSERT INTO public.veiculos (id, vagas_passageiros) VALUES
  ('99999999-9999-9999-9999-999999999999', 4);

INSERT INTO public.ofertas_capacidade (id, driver_id, veiculo_id, estado) VALUES
  ('11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999999', 'disponivel'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '99999999-9999-9999-9999-999999999999', 'disponivel');

UPDATE public.ofertas_capacidade SET is_test = false WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.ofertas_capacidade SET is_test = true WHERE id = '22222222-2222-2222-2222-222222222222';

INSERT INTO public.procuras (id, owner_id, estado) VALUES
  ('33333333-3333-3333-3333-333333333333', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'activa'),
  ('44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'activa');

UPDATE public.procuras SET is_test = false WHERE id = '33333333-3333-3333-3333-333333333333';
UPDATE public.procuras SET is_test = true WHERE id = '44444444-4444-4444-4444-444444444444';

INSERT INTO public.propostas (id, oferta_id, procura_id, created_by, estado) VALUES
  ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'aberta');

INSERT INTO public.acordos (id, oferta_id, procura_id, driver_id) VALUES
  ('66666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

INSERT INTO public.acordos_passageiros (id, acordo_id, passenger_id) VALUES
  ('77777777-7777-7777-7777-777777777777', '66666666-6666-6666-6666-666666666666', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

CREATE OR REPLACE FUNCTION public._proof_assert(p_ok boolean, p_msg text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT p_ok THEN
    RAISE EXCEPTION 'ASSERT FAILED: %', p_msg;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._proof_set_user(p_user uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

CREATE OR REPLACE FUNCTION public._proof_set_anon()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '', true);
  EXECUTE 'SET LOCAL ROLE anon';
END;
$$;

\echo '=== (a) SELECT ofertas/procuras/propostas — sem 42P17 ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public._proof_set_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  SELECT count(*) INTO v_count FROM public.ofertas_capacidade;
  PERFORM public._proof_assert(v_count = 1, '(a) visitante vê 1 oferta real');
  SELECT count(*) INTO v_count FROM public.procuras;
  PERFORM public._proof_assert(v_count = 1, '(a) visitante vê 1 procura real');
  SELECT count(*) INTO v_count FROM public.propostas;
  PERFORM public._proof_assert(v_count = 0, '(a) visitante vê 0 propostas');
END;
$$;

\echo '=== (a2) SELECT propostas por papel — sem 42P17 ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public._proof_set_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  SELECT count(*) INTO v_count FROM public.propostas;
  PERFORM public._proof_assert(v_count = 1, '(a2) motorista vê proposta da oferta teste');

  PERFORM public._proof_set_user('dddddddd-dddd-dddd-dddd-dddddddddddd');
  SELECT count(*) INTO v_count FROM public.propostas;
  PERFORM public._proof_assert(v_count = 1, '(a2) dono procura vê proposta');

  PERFORM public._proof_set_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  SELECT count(*) INTO v_count FROM public.propostas;
  PERFORM public._proof_assert(v_count = 0, '(a2) QA allowlist não vê proposta alheia (só is_test browse)');

  PERFORM public._proof_set_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  SELECT count(*) INTO v_count FROM public.propostas;
  PERFORM public._proof_assert(v_count = 0, '(a2) estranho vê 0 propostas');
END;
$$;

\echo '=== (b) Utilizador normal não vê is_test alheio ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public._proof_set_user('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee');
  SELECT count(*) INTO v_count FROM public.ofertas_capacidade WHERE is_test = true;
  PERFORM public._proof_assert(v_count = 0, '(b) visitante não vê ofertas is_test');
  SELECT count(*) INTO v_count FROM public.procuras WHERE is_test = true;
  PERFORM public._proof_assert(v_count = 0, '(b) visitante não vê procuras is_test');
END;
$$;

\echo '=== (c) QA allowlist vê ofertas/procuras is_test ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public._proof_set_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
  SELECT count(*) INTO v_count FROM public.ofertas_capacidade WHERE is_test = true;
  PERFORM public._proof_assert(v_count >= 1, '(c) QA vê ofertas is_test');
  SELECT count(*) INTO v_count FROM public.procuras WHERE is_test = true;
  PERFORM public._proof_assert(v_count >= 1, '(c) QA vê procuras is_test');
END;
$$;

\echo '=== (d) Participante vê is_test em que participa ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public._proof_set_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
  SELECT count(*) INTO v_count FROM public.ofertas_capacidade WHERE id = '22222222-2222-2222-2222-222222222222';
  PERFORM public._proof_assert(v_count = 1, '(d) passageiro com acordo vê oferta is_test');
END;
$$;

\echo '=== (e) critiquito.x@gmail.com fora da allowlist ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.qa_accounts WHERE user_id = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
  PERFORM public._proof_assert(v_count = 0, '(e) critiquito.x@gmail.com não está em qa_accounts');

  PERFORM public._proof_set_user('ffffffff-ffff-ffff-ffff-ffffffffffff');
  PERFORM public._proof_assert(NOT public.viewer_is_qa(), '(e) viewer_is_qa false fora da allowlist');
  SELECT count(*) INTO v_count FROM public.ofertas_capacidade WHERE is_test = true;
  PERFORM public._proof_assert(v_count = 0, '(e) critiquito.* fora allowlist não vê ofertas is_test');
  SELECT count(*) INTO v_count FROM public.procuras WHERE is_test = true;
  PERFORM public._proof_assert(v_count = 0, '(e) critiquito.* fora allowlist não vê procuras is_test');
END;
$$;

\echo '=== (f) anon não vê is_test ==='
DO $$
DECLARE
  v_count integer;
BEGIN
  PERFORM public._proof_set_anon();
  SELECT count(*) INTO v_count FROM public.ofertas_capacidade;
  PERFORM public._proof_assert(v_count = 1, '(f) anon vê só oferta real');
  SELECT count(*) INTO v_count FROM public.procuras;
  PERFORM public._proof_assert(v_count = 1, '(f) anon vê só procura real');
END;
$$;

\echo '=== FIM prova smoke_3a RLS — todas as asserções OK ==='
