-- fix(sec): RLS/column grants — riscos médios (auditoria 2026-10-09)
-- Âmbito: procuras, propostas, faltas, membros_grupo, pagamentos_acordo,
-- veiculos, grupos, push_subscriptions, lista_espera, storage comprovativos.
-- Fora de âmbito: perfis/notificacoes/RPCs internas (PR #239), ofertas_capacidade (PR #236).

-- =============================================================================
-- pagamentos_acordo — só RPC (PaymentService.js: SELECT + rpc)
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.pagamentos_acordo FROM authenticated, anon;

DROP POLICY IF EXISTS pagamentos_update_admin ON public.pagamentos_acordo;

-- =============================================================================
-- propostas — só RPC create_proposal / reject / cancel / accept
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.propostas FROM authenticated, anon;

DROP POLICY IF EXISTS propostas_insert_envolvidos ON public.propostas;
DROP POLICY IF EXISTS propostas_update_envolvidos ON public.propostas;

-- =============================================================================
-- faltas — só RPC log_falta (INSERT policy já removida em ENG#11)
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.faltas FROM authenticated, anon;

DROP POLICY IF EXISTS faltas_update_envolvidos ON public.faltas;
DROP POLICY IF EXISTS faltas_delete_envolvidos ON public.faltas;
DROP POLICY IF EXISTS faltas_insert_envolvidos ON public.faltas;

-- =============================================================================
-- procuras — INSERT por colunas (ProcuraService.createProcura); UPDATE só sync N
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.procuras FROM authenticated, anon;

GRANT INSERT (
  owner_id,
  preferred_time,
  return_time,
  origin_name,
  origin_lat,
  origin_lng,
  destination_name,
  destination_lat,
  destination_lng,
  n_candidato,
  teto_mensal_kz,
  dias_semana
) ON TABLE public.procuras TO authenticated;

GRANT UPDATE (n_candidato, updated_at) ON TABLE public.procuras TO authenticated;

-- =============================================================================
-- lista_espera — INSERT colunas (WaitlistService); estado forçado activa
-- =============================================================================
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.lista_espera FROM authenticated, anon;

GRANT INSERT (oferta_id, procura_id, grupo_id) ON TABLE public.lista_espera TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_lista_espera_force_estado_activa()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  NEW.estado := 'activa';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lista_espera_force_estado_activa ON public.lista_espera;
CREATE TRIGGER trg_lista_espera_force_estado_activa
  BEFORE INSERT ON public.lista_espera
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_lista_espera_force_estado_activa();

-- =============================================================================
-- grupos — UPDATE nome/n_maximo; DELETE mantém-se (apagarGrupo)
-- =============================================================================
REVOKE UPDATE ON TABLE public.grupos FROM authenticated, anon;

GRANT UPDATE (nome, n_maximo) ON TABLE public.grupos TO authenticated;

-- =============================================================================
-- veiculos — UPDATE/INSERT colunas do cliente (VehicleSetup, ProfileService)
-- =============================================================================
REVOKE INSERT, UPDATE ON TABLE public.veiculos FROM authenticated, anon;

GRANT INSERT (
  id_motorista,
  marca_modelo,
  matricula,
  capacidade_total,
  vagas_passageiros
) ON TABLE public.veiculos TO authenticated;

GRANT UPDATE (
  marca_modelo,
  matricula,
  capacidade_total,
  vagas_passageiros
) ON TABLE public.veiculos TO authenticated;

-- =============================================================================
-- push_subscriptions — INSERT/DELETE; sem UPDATE (usePushNotifications.js)
-- =============================================================================
REVOKE UPDATE ON TABLE public.push_subscriptions FROM authenticated, anon;

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;

-- =============================================================================
-- membros_grupo — INSERT/UPDATE por colunas (GrupoService.js)
-- =============================================================================
REVOKE INSERT, UPDATE ON TABLE public.membros_grupo FROM authenticated, anon;

GRANT INSERT (
  grupo_id,
  passenger_id,
  pickup_name,
  pickup_lat,
  pickup_lng,
  dropoff_name,
  dropoff_lat,
  dropoff_lng,
  ordem_insercao,
  estado
) ON TABLE public.membros_grupo TO authenticated;

GRANT UPDATE (
  estado,
  pickup_name,
  pickup_lat,
  pickup_lng,
  dropoff_name,
  dropoff_lat,
  dropoff_lng,
  ordem_insercao
) ON TABLE public.membros_grupo TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_membros_grupo_passenger_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.owner_id INTO v_owner
  FROM public.grupos g
  JOIN public.procuras p ON p.id = g.procura_id
  WHERE g.id = NEW.grupo_id;

  IF auth.uid() IS DISTINCT FROM v_owner AND auth.uid() = NEW.passenger_id THEN
    IF NEW.grupo_id IS DISTINCT FROM OLD.grupo_id
       OR NEW.passenger_id IS DISTINCT FROM OLD.passenger_id THEN
      RAISE EXCEPTION 'Não podes alterar o grupo deste pedido.';
    END IF;

    IF lower(NEW.estado) IS DISTINCT FROM lower(OLD.estado)
       AND NOT (
         lower(OLD.estado) IN ('rejeitado', 'saiu', 'pendente')
         AND lower(NEW.estado) = 'pendente'
       ) THEN
      RAISE EXCEPTION 'Não podes alterar o estado deste pedido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_membros_grupo_passenger_update_guard ON public.membros_grupo;
CREATE TRIGGER trg_membros_grupo_passenger_update_guard
  BEFORE UPDATE ON public.membros_grupo
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_membros_grupo_passenger_update_guard();

DROP POLICY IF EXISTS membros_update_self_pickup ON public.membros_grupo;
CREATE POLICY membros_update_self_pickup ON public.membros_grupo
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = passenger_id
    AND lower(estado) IN ('activo', 'pendente')
  )
  WITH CHECK (auth.uid() = passenger_id);

-- =============================================================================
-- Storage: bucket comprovativos-pagamento — sem UPDATE; path ligado ao pagamento
-- =============================================================================
CREATE OR REPLACE FUNCTION public.storage_comprovativo_pagamento_id(p_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF((storage.foldername(p_name))[2], '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.can_access_comprovativo_storage(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT
    CASE
      WHEN (storage.foldername(p_name))[1] = auth.uid()::text THEN true
      WHEN public.is_platform_admin() THEN true
      ELSE EXISTS (
        SELECT 1
        FROM public.pagamentos_acordo pg
        WHERE pg.id = public.storage_comprovativo_pagamento_id(p_name)
          AND (
            pg.passenger_id = auth.uid()
            OR pg.driver_id = auth.uid()
          )
      )
    END;
$$;

REVOKE EXECUTE ON FUNCTION public.storage_comprovativo_pagamento_id(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_comprovativo_storage(text) FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS comprovativos_update_own ON storage.objects;

DROP POLICY IF EXISTS comprovativos_insert_own ON storage.objects;
CREATE POLICY comprovativos_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'comprovativos-pagamento'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public.pagamentos_acordo pg
      WHERE pg.id = public.storage_comprovativo_pagamento_id(name)
        AND pg.passenger_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS comprovativos_select_own_or_admin ON storage.objects;
CREATE POLICY comprovativos_select_partes_acordo ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'comprovativos-pagamento'
    AND public.can_access_comprovativo_storage(name)
  );

-- Defesa em profundidade: TRUNCATE nas tabelas do âmbito
REVOKE TRUNCATE ON TABLE public.procuras FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.propostas FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.faltas FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.membros_grupo FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.pagamentos_acordo FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.lista_espera FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.grupos FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.veiculos FROM authenticated, anon;
REVOKE TRUNCATE ON TABLE public.push_subscriptions FROM authenticated, anon;
