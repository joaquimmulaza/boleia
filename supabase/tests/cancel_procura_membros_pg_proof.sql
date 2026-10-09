-- Prova PostgreSQL: cancel_procura marca membros saiu + fecha grupo; acordo intacto.
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;

CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY,
  nome_completo text
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
  dias_semana integer[] DEFAULT ARRAY[1,2,3,4,5],
  estado text NOT NULL DEFAULT 'activa',
  is_test boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procura_id uuid NOT NULL UNIQUE REFERENCES public.procuras(id) ON DELETE CASCADE,
  nome text,
  n_maximo integer NOT NULL DEFAULT 4,
  estado text NOT NULL DEFAULT 'aberto'
);

CREATE TABLE IF NOT EXISTS public.membros_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL REFERENCES public.perfis(id),
  estado text NOT NULL DEFAULT 'activo'
    CHECK (estado = ANY (ARRAY['activo'::text, 'saiu'::text, 'pendente'::text, 'rejeitado'::text])),
  ordem_insercao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  saiu_em timestamptz
);

CREATE TABLE IF NOT EXISTS public.ofertas_capacidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.perfis(id),
  departure_time time,
  dias_semana integer[],
  flexibilidade_rota boolean DEFAULT false,
  origin_lat numeric,
  origin_lng numeric,
  destination_lat numeric,
  destination_lng numeric,
  estado text NOT NULL DEFAULT 'disponivel'
);

CREATE TABLE IF NOT EXISTS public.propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id),
  procura_id uuid NOT NULL REFERENCES public.procuras(id),
  created_by uuid NOT NULL REFERENCES public.perfis(id),
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  valor_mensal_ask_kz integer NOT NULL DEFAULT 10000,
  n_passageiros_propostos integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'aberta'
);

CREATE TABLE IF NOT EXISTS public.lista_espera (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id),
  procura_id uuid NOT NULL REFERENCES public.procuras(id),
  estado text NOT NULL DEFAULT 'activa'
);

CREATE TABLE IF NOT EXISTS public.acordos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.ofertas_capacidade(id),
  procura_id uuid REFERENCES public.procuras(id),
  driver_id uuid NOT NULL REFERENCES public.perfis(id),
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  n_passageiros_contrato integer NOT NULL DEFAULT 1,
  valor_mensal_total_kz integer NOT NULL DEFAULT 10000,
  valor_mensal_por_passageiro_kz integer NOT NULL DEFAULT 10000,
  estado text NOT NULL DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS public.acordos_passageiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acordo_id uuid NOT NULL REFERENCES public.acordos(id),
  passenger_id uuid NOT NULL REFERENCES public.perfis(id),
  quota_mensal_kz integer NOT NULL DEFAULT 10000,
  estado text NOT NULL DEFAULT 'activo'
);

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfis(id),
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'info',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

\i supabase/migrations/20260908225833_editar_procura_update_cancel_rpc.sql
\i supabase/migrations/20261009170000_cancel_procura_membros_saiu.sql

DO $$
DECLARE
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_other uuid := '22222222-2222-2222-2222-222222222222';
  v_driver uuid := '33333333-3333-3333-3333-333333333333';
  v_procura uuid;
  v_grupo uuid;
  v_oferta uuid;
  v_acordo uuid;
  v_n integer;
  v_estado text;
  v_tem_saiu_em boolean;
BEGIN
  INSERT INTO public.perfis (id) VALUES (v_owner), (v_other), (v_driver);

  IF NOT has_function_privilege('authenticated', 'public.cancel_procura(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated sem EXECUTE em cancel_procura';
  END IF;

  -- Cenário 1: um membro → saiu + grupo fechado
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato)
  VALUES (gen_random_uuid(), v_owner, 'activa', 1)
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id) VALUES (v_procura) RETURNING id INTO v_grupo;
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
  VALUES (v_grupo, v_owner, 'activo');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM public.cancel_procura(v_procura);

  SELECT estado, (saiu_em IS NOT NULL) INTO v_estado, v_tem_saiu_em
  FROM public.membros_grupo
  WHERE grupo_id = v_grupo AND passenger_id = v_owner;
  IF lower(v_estado) <> 'saiu' OR NOT v_tem_saiu_em THEN
    RAISE EXCEPTION 'FAIL: membro único deveria estar saiu com saiu_em';
  END IF;

  SELECT estado INTO v_estado FROM public.grupos WHERE id = v_grupo;
  IF lower(v_estado) <> 'fechado' THEN
    RAISE EXCEPTION 'FAIL: grupo deveria estar fechado';
  END IF;

  -- Cenário 2: dois membros — dono cancela, outro fica activo, grupo aberto
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato)
  VALUES (gen_random_uuid(), v_owner, 'activa', 2)
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id) VALUES (v_procura) RETURNING id INTO v_grupo;
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado) VALUES
    (v_grupo, v_owner, 'activo'),
    (v_grupo, v_other, 'activo');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM public.cancel_procura(v_procura);

  SELECT COUNT(*)::integer INTO v_n
  FROM public.membros_grupo
  WHERE grupo_id = v_grupo AND lower(estado) = 'activo';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL: deveria restar 1 membro activo (contagem=%)', v_n;
  END IF;

  SELECT estado INTO v_estado FROM public.grupos WHERE id = v_grupo;
  IF lower(v_estado) <> 'aberto' THEN
    RAISE EXCEPTION 'FAIL: grupo deveria permanecer aberto';
  END IF;

  -- Cenário 3: acordo activo bloqueia cancel (linhas intactas)
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato)
  VALUES (gen_random_uuid(), v_owner, 'activa', 1)
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id) VALUES (v_procura) RETURNING id INTO v_grupo;
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
  VALUES (v_grupo, v_owner, 'activo');

  INSERT INTO public.ofertas_capacidade (id, driver_id) VALUES (gen_random_uuid(), v_driver)
  RETURNING id INTO v_oferta;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco,
    n_passageiros_contrato, valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    gen_random_uuid(), v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO',
    1, 10000, 10000, 'activo'
  ) RETURNING id INTO v_acordo;

  INSERT INTO public.acordos_passageiros (acordo_id, passenger_id, quota_mensal_kz, estado)
  VALUES (v_acordo, v_owner, 10000, 'activo');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  BEGIN
    PERFORM public.cancel_procura(v_procura);
    RAISE EXCEPTION 'FAIL: cancel_procura deveria falhar com acordo activo';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('acordo' in lower(SQLERRM)) = 0 THEN
        RAISE;
      END IF;
  END;

  SELECT COUNT(*)::integer INTO v_n FROM public.acordos WHERE id = v_acordo AND lower(estado) = 'activo';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL: acordo deveria permanecer activo';
  END IF;

  RAISE NOTICE 'OK: cancel_procura_membros_pg_proof passou';
END $$;
