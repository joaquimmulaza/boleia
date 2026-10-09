-- Prova PostgreSQL: grants/policies fix(sec) tabelas médias + storage comprovativos.
-- Aplica a migração e faz ASSERT via has_*_privilege / pg_policies (não reaplica grants manualmente).
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

-- Stubs mínimos (colunas referenciadas pela migração / helpers storage)
CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY,
  is_admin boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.procuras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfis(id),
  preferred_time time NOT NULL DEFAULT '07:00',
  return_time time,
  origin_name text,
  origin_lat numeric,
  origin_lng numeric,
  destination_name text,
  destination_lat numeric,
  destination_lng numeric,
  n_candidato integer NOT NULL DEFAULT 1,
  teto_mensal_kz integer,
  dias_semana integer[],
  estado text NOT NULL DEFAULT 'activa',
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procura_id uuid NOT NULL UNIQUE REFERENCES public.procuras(id) ON DELETE CASCADE,
  nome text,
  n_maximo integer NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS public.membros_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.perfis(id),
  pickup_name text,
  pickup_lat numeric,
  pickup_lng numeric,
  dropoff_name text,
  dropoff_lat numeric,
  dropoff_lng numeric,
  estado text NOT NULL DEFAULT 'activo',
  ordem_insercao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ofertas_capacidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.perfis(id)
);

CREATE TABLE IF NOT EXISTS public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id),
  procura_id uuid NOT NULL REFERENCES public.procuras(id),
  created_by uuid NOT NULL REFERENCES public.perfis(id),
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  valor_mensal_ask_kz integer NOT NULL DEFAULT 0,
  n_passageiros_propostos integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'aberta'
);

CREATE TABLE IF NOT EXISTS public.lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id),
  procura_id uuid NOT NULL REFERENCES public.procuras(id),
  grupo_id uuid REFERENCES public.grupos(id),
  estado text NOT NULL DEFAULT 'activa'
);

CREATE TABLE IF NOT EXISTS public.acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.perfis(id)
);

CREATE TABLE IF NOT EXISTS public.acordos_passageiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id),
  passenger_id uuid NOT NULL REFERENCES public.perfis(id),
  estado text NOT NULL DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS public.pagamentos_acordo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id),
  acordo_passageiro_id uuid NOT NULL UNIQUE REFERENCES public.acordos_passageiros(id),
  passenger_id uuid NOT NULL REFERENCES public.perfis(id),
  driver_id uuid NOT NULL REFERENCES public.perfis(id),
  valor_kz integer NOT NULL DEFAULT 0,
  valor_payout_liquido_kz integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'pendente_pagamento'
);

CREATE TABLE IF NOT EXISTS public.faltas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_acordo uuid NOT NULL REFERENCES public.acordos(id),
  passenger_id uuid NOT NULL REFERENCES public.perfis(id),
  data_falta date NOT NULL,
  tipo text NOT NULL DEFAULT 'Passageiro',
  viagem text
);

CREATE TABLE IF NOT EXISTS public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_motorista uuid NOT NULL UNIQUE REFERENCES public.perfis(id),
  marca_modelo text,
  matricula text,
  capacidade_total integer NOT NULL DEFAULT 4,
  vagas_passageiros integer NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfis(id),
  subscription jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT false;
$$;

-- Grants pré-fix (simula prod)
GRANT INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

CREATE POLICY pagamentos_update_admin ON public.pagamentos_acordo
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY propostas_insert_envolvidos ON public.propostas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY faltas_update_envolvidos ON public.faltas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY faltas_delete_envolvidos ON public.faltas
  FOR DELETE TO authenticated USING (true);

CREATE SCHEMA IF NOT EXISTS storage;
GRANT USAGE ON SCHEMA storage TO authenticated, anon;

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
  public boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text,
  name text,
  owner uuid
);
INSERT INTO storage.buckets (id, name, public)
VALUES ('comprovativos-pagamento', 'comprovativos-pagamento', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS comprovativos_update_own ON storage.objects;
CREATE POLICY comprovativos_update_own ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'comprovativos-pagamento')
  WITH CHECK (bucket_id = 'comprovativos-pagamento');

DROP POLICY IF EXISTS comprovativos_insert_own ON storage.objects;
CREATE POLICY comprovativos_insert_own ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'comprovativos-pagamento');

DROP POLICY IF EXISTS comprovativos_select_own_or_admin ON storage.objects;
CREATE POLICY comprovativos_select_own_or_admin ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'comprovativos-pagamento');

\i supabase/migrations/20261009150000_sec_rls_grants_medio.sql

DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.pagamentos_acordo', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: falta GRANT SELECT em pagamentos_acordo';
  END IF;

  IF has_table_privilege('authenticated', 'public.pagamentos_acordo', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em pagamentos_acordo';
  END IF;

  IF has_table_privilege('authenticated', 'public.propostas', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem INSERT em propostas';
  END IF;

  IF has_table_privilege('authenticated', 'public.faltas', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem INSERT em faltas';
  END IF;

  IF has_column_privilege('authenticated', 'public.procuras', 'estado', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em procuras.estado';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.procuras', 'n_candidato', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: falta GRANT UPDATE em procuras.n_candidato';
  END IF;

  IF has_column_privilege('authenticated', 'public.procuras', 'estado', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem INSERT em procuras.estado';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.lista_espera', 'oferta_id', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: falta INSERT em lista_espera.oferta_id';
  END IF;

  IF has_table_privilege('authenticated', 'public.lista_espera', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em lista_espera';
  END IF;

  IF has_column_privilege('authenticated', 'public.grupos', 'procura_id', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em grupos.procura_id';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.grupos', 'n_maximo', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: falta GRANT UPDATE em grupos.n_maximo';
  END IF;

  IF NOT has_table_privilege('authenticated', 'public.grupos', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL: falta GRANT DELETE em grupos';
  END IF;

  IF NOT has_column_privilege('authenticated', 'public.push_subscriptions', 'subscription', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: falta GRANT INSERT em push_subscriptions.subscription';
  END IF;

  IF has_column_privilege('authenticated', 'public.veiculos', 'id_motorista', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em veiculos.id_motorista';
  END IF;

  IF has_table_privilege('authenticated', 'public.push_subscriptions', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated ainda tem UPDATE em push_subscriptions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'membros_grupo' AND policyname = 'membros_update_self_pickup'
  ) THEN
    RAISE EXCEPTION 'FAIL: policy membros_update_self_pickup em falta';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'comprovativos_update_own'
  ) THEN
    RAISE EXCEPTION 'FAIL: policy comprovativos_update_own ainda existe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'comprovativos_select_partes_acordo'
  ) THEN
    RAISE EXCEPTION 'FAIL: policy comprovativos_select_partes_acordo em falta';
  END IF;

  RAISE NOTICE 'OK: sec_rls_grants_medio_pg_proof passou';
END $$;
