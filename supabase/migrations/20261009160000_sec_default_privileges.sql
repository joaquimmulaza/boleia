-- fix(sec): perfis INSERT/DELETE, trigger EXECUTE, default privileges (só FUNCTIONS).
-- Depende de #236, #239, #240 aplicados. Timestamp fixo: 20261009160000.
--
-- Operacional: novas RPCs criadas por postgres passam a exigir GRANT EXECUTE explícito;
-- sessão autenticada mantém default EXECUTE; anon/PUBLIC deixam de herdar EXECUTE em funções novas.
-- RPC anónima no cliente (rg src/ 2026-10-09): nenhuma — ver bloco anon_rpc_allowlist abaixo.
--
-- Nota #240 (20261009150000): o comentário «sem UPDATE» na secção storage referia-se a não
-- conceder UPDATE amplo em storage.objects; a mesma migração inclui a policy
-- comprovativos_update_own (passageiro pode substituir comprovativo no path validado).

-- =============================================================================
-- 1. perfis — cliente só SELECT (colunas) + UPDATE (colunas); sem INSERT/DELETE
-- =============================================================================
-- Criação: trigger SECURITY DEFINER handle_new_user (auth.users).
-- Apagar conta: RPC delete_own_account() (SECURITY DEFINER).

REVOKE INSERT, DELETE ON TABLE public.perfis FROM authenticated, anon;

-- =============================================================================
-- 2. Funções trigger — callers não precisam de EXECUTE
-- =============================================================================
REVOKE EXECUTE ON FUNCTION public.trg_marketplace_is_test_oferta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_marketplace_is_test_procura() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      p.oid,
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      r.schema_name,
      r.function_name,
      r.args
    );
  END LOOP;
END $$;

-- =============================================================================
-- 3. Default privileges — APENAS FUNCTIONS (nunca TABLES/SEQUENCES)
-- =============================================================================
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Preservar defaults Supabase: novas funções em public continuam executáveis por authenticated/service_role.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- =============================================================================
-- anon_rpc_allowlist: (vazio)
-- Inventário logged-out (/, /explorar, /auth, /privacidade, /eliminacao-de-dados):
--   browse → SELECT ofertas_capacidade, procuras (sem supabase.rpc).
-- Após 20261006120000_revoke_anon_privileges_defense, anon não tinha EXECUTE em RPCs;
-- default privileges reforçam o mesmo para funções futuras. Sem GRANT EXECUTE TO anon abaixo.
-- =============================================================================

-- =============================================================================
-- 4. #240 soft: UUID case-insensitive em storage_comprovativo_pagamento_id
-- =============================================================================
CREATE OR REPLACE FUNCTION public.storage_comprovativo_pagamento_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public, storage
AS $$
DECLARE
  v_segment text;
BEGIN
  v_segment := NULLIF((storage.foldername(p_name))[2], '');
  IF v_segment IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN v_segment::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.storage_comprovativo_pagamento_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storage_comprovativo_pagamento_id(text) TO authenticated;
