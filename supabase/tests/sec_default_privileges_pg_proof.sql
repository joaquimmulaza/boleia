-- Prova PostgreSQL pós ALL migrations + 20261009160000 (asserções a–e).
\set ON_ERROR_STOP on

\echo '=== (a) perfis: INSERT/DELETE revogados; UPDATE/SELECT por colunas ==='
DO $$
BEGIN
  IF has_table_privilege('authenticated', 'public.perfis', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL (a): authenticated INSERT em perfis';
  END IF;
  IF has_table_privilege('authenticated', 'public.perfis', 'DELETE') THEN
    RAISE EXCEPTION 'FAIL (a): authenticated DELETE em perfis';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.perfis', 'nome_completo', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL (a): authenticated sem UPDATE nome_completo';
  END IF;
  IF NOT has_column_privilege('authenticated', 'public.perfis', 'id', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL (a): authenticated sem SELECT id';
  END IF;
  RAISE NOTICE 'PASS (a): perfis INSERT/DELETE=false; UPDATE/SELECT colunas OK';
END $$;

\echo '=== (b) trigger functions: sem EXECUTE; triggers disparam ==='
DO $$
DECLARE
  r record;
  v_uid uuid := gen_random_uuid();
  v_qa uuid := gen_random_uuid();
  v_grupo uuid;
  v_procura uuid;
  v_oferta_id uuid;
  v_veiculo uuid;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
  LOOP
    IF has_function_privilege('anon', r.oid, 'EXECUTE')
       OR has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL (b): EXECUTE em trigger % (%) para anon/authenticated',
        r.proname, r.args;
    END IF;
  END LOOP;

  INSERT INTO auth.users (id, email) VALUES (v_qa, 'qa@boleiacerta.test');
  UPDATE public.perfis SET tipo_perfil = 'Motorista' WHERE id = v_qa;
  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_qa, 'Proof', 'PG-001', 4, 3)
  RETURNING id INTO v_veiculo;
  INSERT INTO public.qa_accounts (user_id, note) VALUES (v_qa, 'pg-proof')
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.sub', v_qa::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  INSERT INTO public.ofertas_capacidade (
    driver_id, veiculo_id, flexibilidade_rota, departure_time, vagas_disponiveis, vagas_totais,
    modo_preco, valor_mensal_ask_kz, estado
  ) VALUES (
    v_qa, v_veiculo, true, '07:00', 3, 3, 'POR_PASSAGEIRO', 50000, 'disponivel'
  ) RETURNING id INTO v_oferta_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.ofertas_capacidade WHERE id = v_oferta_id AND is_test IS true
  ) THEN
    RAISE EXCEPTION 'FAIL (b): trg_marketplace_is_test_oferta não marcou is_test';
  END IF;

  RESET ROLE;

  INSERT INTO auth.users (id, email) VALUES (v_uid, 'pax@example.com');

  INSERT INTO public.procuras (
    owner_id, preferred_time, n_candidato, estado
  ) VALUES (v_uid, '07:30', 1, 'activa') RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id, nome, n_maximo)
  VALUES (v_procura, 'G proof', 4) RETURNING id INTO v_grupo;

  PERFORM set_config('request.jwt.claim.sub', v_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;

  BEGIN
    INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
    VALUES (v_grupo, v_uid, 'invalido');
    RAISE EXCEPTION 'FAIL (b): trg_membros_grupo_insert_estado_guard não bloqueou estado inválido';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%Estado inicial inválido%' THEN
        RAISE;
      END IF;
  END;

  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
  VALUES (v_grupo, v_uid, 'activo');

  RESET ROLE;
  RAISE NOTICE 'PASS (b): triggers sem EXECUTE; is_test + guard membros OK';
END $$;

\echo '=== (c) função nova pós-migração: authenticated sim; anon/PUBLIC não ==='
DO $$
BEGIN
  CREATE OR REPLACE FUNCTION public._sec_default_priv_post_migration_probe()
  RETURNS integer
  LANGUAGE sql
  AS $probe$ SELECT 1 $probe$;

  IF has_function_privilege('anon', 'public._sec_default_priv_post_migration_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL (c): anon EXECUTE função nova';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public._sec_default_priv_post_migration_probe()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL (c): authenticated sem EXECUTE função nova';
  END IF;

  DROP FUNCTION public._sec_default_priv_post_migration_probe();
  RAISE NOTICE 'PASS (c): default privileges FUNCTIONS OK';
END $$;

\echo '=== (d) signup trigger + delete_own_account ==='
DO $$
DECLARE
  v_new uuid := gen_random_uuid();
  v_email text := 'delete-proof@example.com';
BEGIN
  INSERT INTO auth.users (id, email, raw_user_meta_data)
  VALUES (v_new, v_email, '{"nome_completo":"Signup Proof","telefone":"923456789","tipo_perfil":"Passageiro"}'::jsonb);

  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = v_new) THEN
    RAISE EXCEPTION 'FAIL (d): handle_new_user não criou perfis';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_new::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL ROLE authenticated;
  PERFORM public.delete_own_account();
  RESET ROLE;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_new) THEN
    RAISE EXCEPTION 'FAIL (d): delete_own_account não removeu auth.users';
  END IF;

  RAISE NOTICE 'PASS (d): handle_new_user + delete_own_account OK';
END $$;

\echo '=== (e) RPCs do cliente (src/) executáveis por authenticated ==='
DO $$
DECLARE
  v_rpc text;
  v_rpcs text[] := ARRAY[
    'accept_agreement_adenda', 'accept_proposal', 'admin_liquidate_payment',
    'admin_liquidate_period', 'admin_motoristas_tem_iban', 'admin_validate_payment',
    'apply_due_agreement_adendas', 'apply_due_agreement_non_renewals',
    'apply_due_agreement_terminations', 'apply_due_reserva_expiry',
    'cancel_agreement_adenda', 'cancel_oferta', 'cancel_procura', 'cancel_proposal',
    'create_proposal', 'create_procura_with_grupo', 'decline_agreement_renewal',
    'delete_own_account', 'get_acordo_contactos', 'get_own_perfil_contacto',
    'is_platform_admin', 'leave_grupo_membro', 'leave_passenger', 'log_falta',
    'lookup_perfil_por_telefone', 'promote_waitlist', 'reactivate_oferta',
    'reject_agreement_adenda', 'reject_agreement_termination', 'reject_proposal',
    'renew_agreement_period', 'renegotiate_agreement_pricing', 'respond_agreement_adenda',
    'submit_avaliacao_acordo', 'submit_payment_proof', 'terminate_agreement',
    'update_oferta', 'update_procura', 'was_avaliado_por'
  ];
  r record;
  v_any boolean;
BEGIN
  FOREACH v_rpc IN ARRAY v_rpcs LOOP
    v_any := false;
    FOR r IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_rpc
    LOOP
      IF has_function_privilege('authenticated', r.oid, 'EXECUTE') THEN
        v_any := true;
        EXIT;
      END IF;
    END LOOP;
    IF NOT v_any THEN
      RAISE EXCEPTION 'FAIL (e): authenticated sem EXECUTE em RPC %', v_rpc;
    END IF;
  END LOOP;
  RAISE NOTICE 'PASS (e): % RPCs cliente com EXECUTE authenticated', array_length(v_rpcs, 1);
END $$;

\echo '=== (f) storage_comprovativo UUID maiúsculas (~*) ==='
DO $$
DECLARE v uuid;
BEGIN
  v := public.storage_comprovativo_pagamento_id(
    'uid/' || upper('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee') || '/file.pdf'
  );
  IF v IS NULL THEN
    RAISE EXCEPTION 'FAIL (f): UUID maiúsculo rejeitado';
  END IF;
  RAISE NOTICE 'PASS (f): storage_comprovativo_pagamento_id ~* OK';
END $$;

\echo OK: sec_default_privileges_pg_proof completo
