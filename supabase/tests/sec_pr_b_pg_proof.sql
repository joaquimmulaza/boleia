-- Prova PostgreSQL: Security PR B (push anon revoke + create_proposal grupo)
\set ON_ERROR_STOP on

\i supabase/tests/bootstrap_local_supabase.sql

CREATE TABLE IF NOT EXISTS public.perfis (
  id uuid PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subscription)
);

CREATE TABLE IF NOT EXISTS public.procuras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.perfis(id),
  preferred_time time NOT NULL DEFAULT '07:00',
  n_candidato integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'activa',
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
  grupo_id uuid REFERENCES public.grupos(id),
  modo_preco text NOT NULL DEFAULT 'POR_PASSAGEIRO',
  valor_mensal_ask_kz integer NOT NULL DEFAULT 10000,
  n_passageiros_propostos integer NOT NULL DEFAULT 1,
  estado text NOT NULL DEFAULT 'aberta',
  created_by uuid NOT NULL REFERENCES public.perfis(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS propostas_aberta_iniciador_unique
  ON public.propostas (oferta_id, procura_id, created_by)
  WHERE estado = 'aberta';

CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.perfis(id),
  mensagem text NOT NULL,
  tipo text,
  metadata jsonb,
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vault stub (produção: extensão Supabase Vault)
CREATE SCHEMA IF NOT EXISTS vault;
DROP VIEW IF EXISTS vault.decrypted_secrets;
CREATE VIEW vault.decrypted_secrets AS
SELECT NULL::text AS name, NULL::text AS decrypted_secret
WHERE false;

-- pg_net stub mínimo
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  headers jsonb DEFAULT '{}'::jsonb,
  body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 1;
END;
$$;

\i supabase/migrations/20261010100000_sec_pr_b_push_webhook_grants_create_proposal.sql

DO $$
DECLARE
  v_owner uuid := gen_random_uuid();
  v_outsider uuid := gen_random_uuid();
  v_driver uuid := gen_random_uuid();
  v_procura_a uuid := gen_random_uuid();
  v_procura_b uuid := gen_random_uuid();
  v_grupo_a uuid := gen_random_uuid();
  v_grupo_b uuid := gen_random_uuid();
  v_oferta uuid := gen_random_uuid();
  v_err text;
BEGIN
  INSERT INTO public.perfis (id) VALUES (v_owner), (v_outsider), (v_driver);
  INSERT INTO public.procuras (id, owner_id) VALUES (v_procura_a, v_owner), (v_procura_b, v_outsider);
  INSERT INTO public.grupos (id, procura_id) VALUES (v_grupo_a, v_procura_a), (v_grupo_b, v_procura_b);
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
  VALUES (v_grupo_a, v_owner, 'activo');
  INSERT INTO public.ofertas_capacidade (id, driver_id) VALUES (v_oferta, v_driver);

  -- anon INSERT em push_subscriptions → 42501
  BEGIN
    SET LOCAL ROLE anon;
    INSERT INTO public.push_subscriptions (user_id, subscription)
    VALUES (v_owner, '{"endpoint":"https://x"}'::jsonb);
    RAISE EXCEPTION 'FAIL: anon conseguiu INSERT em push_subscriptions';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
  RESET ROLE;

  -- trigger tolera secret em falta
  INSERT INTO public.notificacoes (user_id, mensagem, tipo)
  VALUES (v_owner, 'teste push', 'generic');

  -- outsider: grupo de outra procura
  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM public.create_proposal(
      v_oferta, v_procura_b, v_grupo_a, 'POR_PASSAGEIRO', 10000, 1
    );
    RAISE EXCEPTION 'FAIL: create_proposal aceitou grupo de outra procura';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT LIKE '%Grupo não pertence a esta procura.%' THEN
        RAISE EXCEPTION 'FAIL: mensagem inesperada outsider grupo: %', v_err;
      END IF;
  END;

  -- owner: N > membros activos
  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  BEGIN
    PERFORM public.create_proposal(
      v_oferta, v_procura_a, v_grupo_a, 'POR_PASSAGEIRO', 10000, 3
    );
    RAISE EXCEPTION 'FAIL: create_proposal aceitou N > membros activos';
  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      IF v_err NOT LIKE '%excede os membros activos%' THEN
        RAISE EXCEPTION 'FAIL: mensagem inesperada N>membros: %', v_err;
      END IF;
  END;

  -- owner: caso válido
  PERFORM public.create_proposal(
    v_oferta, v_procura_a, v_grupo_a, 'POR_PASSAGEIRO', 12000, 1
  );

  RAISE NOTICE 'OK: sec_pr_b_pg_proof passou';
END $$;
