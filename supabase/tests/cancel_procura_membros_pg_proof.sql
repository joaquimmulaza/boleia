-- Prova: cancel_procura + leave_grupo_membro + guards (após apply-all-migrations-local).
\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS net;

CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  headers jsonb DEFAULT '{}'::jsonb,
  body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE sql
AS $$ SELECT 1; $$;

DO $$
DECLARE
  v_owner uuid := '11111111-1111-1111-1111-111111111111';
  v_other uuid := '22222222-2222-2222-2222-222222222222';
  v_pendente uuid := '33333333-3333-3333-3333-333333333333';
  v_driver uuid := '44444444-4444-4444-4444-444444444444';
  v_procura uuid;
  v_grupo uuid;
  v_oferta uuid;
  v_acordo uuid;
  v_membro_saiu uuid;
  v_n integer;
  v_estado text;
  v_tem_saiu_em boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_owner, 'owner@test.local'),
    (v_other, 'other@test.local'),
    (v_pendente, 'pendente@test.local'),
    (v_driver, 'driver@test.local')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.perfis (id, nome_completo)
  VALUES (v_owner, 'Owner'), (v_other, 'Other'), (v_pendente, 'Pendente'), (v_driver, 'Driver')
  ON CONFLICT (id) DO NOTHING;

  IF NOT has_function_privilege('authenticated', 'public.cancel_procura(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated sem EXECUTE em cancel_procura';
  END IF;

  -- Cenário 1: um membro → cancel → saiu + grupo fechado
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato, preferred_time)
  VALUES (gen_random_uuid(), v_owner, 'activa', 1, '07:00')
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

  -- Cenário 2: 2 activo + 1 pendente → owner cancela; outro activo; depois leave → fechado
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato, preferred_time)
  VALUES (gen_random_uuid(), v_owner, 'activa', 3, '07:00')
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id) VALUES (v_procura) RETURNING id INTO v_grupo;
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado) VALUES
    (v_grupo, v_owner, 'activo'),
    (v_grupo, v_other, 'activo'),
    (v_grupo, v_pendente, 'pendente');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM public.cancel_procura(v_procura);

  SELECT COUNT(*)::integer INTO v_n
  FROM public.membros_grupo
  WHERE grupo_id = v_grupo AND lower(estado) = 'activo';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL: deveria restar 1 activo após cancel (contagem=%)', v_n;
  END IF;

  SELECT COUNT(*)::integer INTO v_n
  FROM public.membros_grupo
  WHERE grupo_id = v_grupo AND lower(estado) = 'rejeitado';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'FAIL: pendente deveria estar rejeitado';
  END IF;

  SELECT estado INTO v_estado FROM public.grupos WHERE id = v_grupo;
  IF lower(v_estado) <> 'aberto' THEN
    RAISE EXCEPTION 'FAIL: grupo deveria permanecer aberto com activo restante';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM public.leave_grupo_membro(v_grupo);

  SELECT estado INTO v_estado FROM public.grupos WHERE id = v_grupo;
  IF lower(v_estado) <> 'fechado' THEN
    RAISE EXCEPTION 'FAIL: grupo deveria fechar após último activo sair';
  END IF;

  -- Cenário 3: acordo activo bloqueia cancel
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato, preferred_time)
  VALUES (gen_random_uuid(), v_owner, 'activa', 1, '07:00')
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id) VALUES (v_procura) RETURNING id INTO v_grupo;
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
  VALUES (v_grupo, v_owner, 'activo');

  INSERT INTO public.veiculos (id_motorista, marca_modelo, matricula, capacidade_total, vagas_passageiros)
  VALUES (v_driver, 'Test', 'AA-00-AA', 4, 3)
  ON CONFLICT (id_motorista) DO NOTHING;

  INSERT INTO public.ofertas_capacidade (
    id,
    driver_id,
    veiculo_id,
    departure_time,
    estado,
    vagas_totais,
    vagas_disponiveis,
    modo_preco,
    valor_mensal_ask_kz
  )
  SELECT gen_random_uuid(), v_driver, v.id, '07:00', 'disponivel', 3, 3, 'POR_PASSAGEIRO', 10000
  FROM public.veiculos v
  WHERE v.id_motorista = v_driver
  RETURNING id INTO v_oferta;

  INSERT INTO public.acordos (
    id, oferta_id, procura_id, driver_id, modo_preco,
    n_passageiros_contrato, valor_mensal_total_kz, valor_mensal_por_passageiro_kz, estado
  ) VALUES (
    gen_random_uuid(), v_oferta, v_procura, v_driver, 'POR_PASSAGEIRO',
    1, 10000, 10000, 'activo'
  ) RETURNING id INTO v_acordo;

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

  -- Cenário 4: INSERT em grupo fechado recusado (trigger)
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato, preferred_time)
  VALUES (gen_random_uuid(), v_owner, 'activa', 1, '07:00')
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id, estado) VALUES (v_procura, 'fechado') RETURNING id INTO v_grupo;

  BEGIN
    INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
    VALUES (v_grupo, v_pendente, 'pendente');
    RAISE EXCEPTION 'FAIL: INSERT em grupo fechado deveria falhar';
  EXCEPTION
    WHEN OTHERS THEN
      IF position('fechado' in lower(SQLERRM)) = 0 THEN
        RAISE;
      END IF;
  END;

  -- Cenário 5: saiu→activo recusado com procura cancelada
  INSERT INTO public.procuras (id, owner_id, estado, n_candidato, preferred_time)
  VALUES (gen_random_uuid(), v_owner, 'cancelada', 1, '07:00')
  RETURNING id INTO v_procura;

  INSERT INTO public.grupos (procura_id, estado) VALUES (v_procura, 'fechado') RETURNING id INTO v_grupo;

  ALTER TABLE public.membros_grupo DISABLE TRIGGER trg_membros_grupo_insert_estado_guard;
  INSERT INTO public.membros_grupo (grupo_id, passenger_id, estado)
  VALUES (v_grupo, v_other, 'saiu')
  RETURNING id INTO v_membro_saiu;
  ALTER TABLE public.membros_grupo ENABLE TRIGGER trg_membros_grupo_insert_estado_guard;

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE public.membros_grupo SET estado = 'activo' WHERE id = v_membro_saiu;
    RESET ROLE;
    RAISE EXCEPTION 'FAIL: saiu→activo deveria ser recusado';
  EXCEPTION
    WHEN OTHERS THEN
      RESET ROLE;
      IF position('activo' in lower(SQLERRM)) = 0 AND position('reactivar' in lower(SQLERRM)) = 0 THEN
        RAISE;
      END IF;
  END;

  RAISE NOTICE 'OK: cancel_procura_membros_pg_proof passou';
END $$;
