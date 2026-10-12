-- Repro manual: temp table ON COMMIT DROP + leitura estática em plpgsql (padrão 25e7b706).
-- Duas transacções na mesma ligação psql → 2.ª falha «could not open relation with OID …»
-- quando o plano fica em cache. Fix #269: array v_acordos_fecha_todo_lote (sem temp table).
--
-- Uso local (NÃO no CI):
--   psql -v ON_ERROR_STOP=1 -d postgres -c 'CREATE DATABASE expiry_oid_repro_test;'
--   psql -v ON_ERROR_STOP=1 -d expiry_oid_repro_test -f supabase/tests/expiry_close_sem_lugares_vivos_temp_table_oid_repro.sql
-- Esperado com padrão bugado: txn1 OK, txn2 ERROR. EC4 na prova principal cobre apply_due corrigido.

\set ON_ERROR_STOP on

CREATE OR REPLACE FUNCTION public._apply_due_temp_table_oid_repro()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $repro$
DECLARE
  v_n integer := 0;
  v_acordo_id uuid;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS _apply_due_expiry_acordo_batch (
    acordo_id uuid PRIMARY KEY,
    fecha_todo_lote boolean NOT NULL
  ) ON COMMIT DROP;

  TRUNCATE _apply_due_expiry_acordo_batch;

  INSERT INTO _apply_due_expiry_acordo_batch (acordo_id, fecha_todo_lote)
  VALUES (gen_random_uuid(), true);

  SELECT acordo_id INTO v_acordo_id
  FROM _apply_due_expiry_acordo_batch
  LIMIT 1;

  IF v_acordo_id IS NULL THEN
    RAISE EXCEPTION 'repro: batch vazia';
  END IF;

  RETURN 1;
END;
$repro$;

\echo 'Repro txn 1 (deve passar)'
BEGIN;
SELECT public._apply_due_temp_table_oid_repro();
COMMIT;

\echo 'Repro txn 2 (padrão 25e7b706: esperado ERROR OID; se passar, ver EC4 na prova principal)'
BEGIN;
SELECT public._apply_due_temp_table_oid_repro();
COMMIT;

DROP FUNCTION IF EXISTS public._apply_due_temp_table_oid_repro();
