-- Defense-in-depth: remove privilégios anon desnecessários.
-- Páginas públicas (/explorar, legal, /auth) só fazem SELECT directo em
-- ofertas_capacidade e procuras (policies ofertas_select_anon_browse /
-- procuras_select_anon_browse) — não invocam RPCs.
--
-- Padrão:
--   1) Funções public (não-extensão): REVOKE EXECUTE FROM PUBLIC, anon;
--      GRANT EXECUTE TO authenticated, service_role (preserva o que authenticated
--      tinha via PUBLIC). Helpers internos com REVOKE explícito de authenticated
--      são re-revogados no fim.
--   2) Tabelas/views public: REVOKE ALL FROM anon; re-GRANT SELECT só em
--      ofertas_capacidade e procuras.
--
-- Não altera corpos de funções, RLS, nem frontend. Aplicar manualmente no
-- projecto Supabase; depois correr as queries de verificação abaixo.

-- ---------------------------------------------------------------------------
-- Step 2: funções public — fechar anon/PUBLIC, manter authenticated
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_depend d
        WHERE d.objid = p.oid
          AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.schema_name,
      r.function_name,
      r.args
    );
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon',
      r.schema_name,
      r.function_name,
      r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated',
      r.schema_name,
      r.function_name,
      r.args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      r.schema_name,
      r.function_name,
      r.args
    );
  END LOOP;
END $$;

-- Helpers internos: authenticated não deve executar directamente (hardening prévio).
REVOKE EXECUTE ON FUNCTION public._haversine_meters(double precision, double precision, double precision, double precision) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.oferta_compativel_com_procura(public.ofertas_capacidade, public.procuras) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_procura_editavel(public.procuras, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._notify_proposta_driver_evento(public.propostas, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._assert_oferta_editavel(public.ofertas_capacidade, uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public._notify_proposta_contraparte_evento(public.propostas, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.recount_oferta_vagas(uuid) FROM authenticated;

-- ---------------------------------------------------------------------------
-- Step 4: tabelas/views public — anon perde tudo excepto browse SELECT
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'v', 'm')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM anon',
      r.schema_name,
      r.table_name
    );
  END LOOP;
END $$;

GRANT SELECT ON TABLE public.ofertas_capacidade TO anon;
GRANT SELECT ON TABLE public.procuras TO anon;

-- ---------------------------------------------------------------------------
-- Step 3 (auditoria): políticas RLS TO anon — nenhuma invoca função public.
--   ofertas_select_anon_browse: USING (estado IN ('disponivel', 'parcial'))
--   procuras_select_anon_browse: USING (estado IN ('activa', 'em_negociacao'))
-- Excepções anon EXECUTE: nenhuma.
-- ---------------------------------------------------------------------------
--
-- Step 5: queries de verificação pós-aplicação (resultado esperado abaixo).
--
-- Funções com EXECUTE para anon (esperado: 0 linhas):
--   SELECT n.nspname,
--          p.proname,
--          pg_get_function_identity_arguments(p.oid) AS args
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   JOIN pg_roles grantee ON grantee.rolname = 'anon'
--   CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
--   WHERE n.nspname = 'public'
--     AND acl.grantee = grantee.oid
--     AND acl.privilege_type = 'EXECUTE'
--   ORDER BY 2, 3;
--
-- Privilégios de tabela para anon (esperado: só SELECT em ofertas_capacidade, procuras):
--   SELECT table_schema,
--          table_name,
--          string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
--   FROM information_schema.role_table_grants
--   WHERE grantee = 'anon'
--     AND table_schema = 'public'
--   GROUP BY table_schema, table_name
--   ORDER BY table_name;
