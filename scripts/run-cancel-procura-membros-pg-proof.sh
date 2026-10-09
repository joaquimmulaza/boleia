#!/usr/bin/env bash
# Prova PostgreSQL cancel_procura + guards (cadeia completa main + 170000).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/cancel_procura_membros_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
BOOTSTRAP_SQL="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
LOCALFIX_PL="${ROOT}/supabase/tests/localfix_migration_sql.pl"
MIG_170000="20261009170000_cancel_procura_membros_saiu.sql"
SKIP_MIG_170000="${SKIP_MIG_170000:-0}"
PROOF_FAIL_GUARDS="${PROOF_FAIL_GUARDS:-0}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado. Instale PostgreSQL (apt install postgresql)." >&2
  exit 2
fi

if ! sudo -u postgres psql -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "==> A arrancar cluster PostgreSQL..."
  sudo pg_ctlcluster 16 main start || sudo service postgresql start || true
fi

cleanup_db() {
  if [[ -n "${1:-}" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${1}\";" postgres >/dev/null 2>&1 || true
  fi
}

apply_migrations_to_db() {
  local db_name="$1"
  local psql=(sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}")

  echo "    -> bootstrap_roles_first.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${ROLES_FIRST}"

  echo "    -> bootstrap_local_supabase.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${BOOTSTRAP_SQL}"

  echo "    -> migrações"
  shopt -s nullglob
  for f in "${ROOT}"/supabase/migrations/*.sql; do
    base="$(basename "$f")"
    if [[ "${SKIP_MIG_170000}" == "1" && "${base}" == "${MIG_170000}" ]]; then
      echo "       skip ${base} (SKIP_MIG_170000=1)"
      continue
    fi
    mig_src="$f"
    if [[ "${base}" == "20260329161035_remote_schema.sql" ]]; then
      mig_src="/tmp/${base}.localfix.${db_name}.sql"
      perl "${LOCALFIX_PL}" <"$f" >"$mig_src"
    fi
    echo "       -> ${base}"
    if ! "${psql[@]}" -f "$mig_src" >/tmp/mig_"${db_name}"_"${base}".log 2>&1; then
      echo "FALHOU: ${base}" >&2
      tail -30 /tmp/mig_"${db_name}"_"${base}".log >&2
      return 4
    fi
  done
}

run_proof() {
  local db_name="$1"
  local label="$2"
  echo ""
  echo "==> Prova SQL (${label})"
  if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${PROOF_SQL}"; then
    echo "FALHOU: asserções cancel_procura (${label})" >&2
    return 5
  fi
  echo "==> OK (${label})"
}

DB="cancel_procura_proof_$$"
trap 'cleanup_db "${DB}"' EXIT

if [[ "${SKIP_MIG_170000}" == "1" ]]; then
  echo "==> fail-on-old: sem ${MIG_170000}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
  apply_migrations_to_db "${DB}"
  echo "==> Prova (deve falhar sem 170000)"
  if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_SQL}" 2>&1; then
    echo "ERRO: prova passou sem 170000" >&2
    exit 6
  fi
  echo "==> OK: fail-on-old sem 170000"
  exit 0
fi

if [[ "${PROOF_FAIL_GUARDS}" == "1" ]]; then
  echo "==> fail-on-old: guards B2 revertidos (cenários 6–9 devem falhar)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
  apply_migrations_to_db "${DB}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f - <<'GUARD_REVERT_SQL'
CREATE OR REPLACE FUNCTION public.trg_membros_grupo_passenger_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_owner uuid;
  v_grupo_estado text;
  v_procura_estado text;
BEGIN
  IF auth.uid() IS NULL OR current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  SELECT p.owner_id, lower(g.estado), lower(p.estado)
  INTO v_owner, v_grupo_estado, v_procura_estado
  FROM public.grupos g
  JOIN public.procuras p ON p.id = g.procura_id
  WHERE g.id = NEW.grupo_id;

  IF auth.uid() = NEW.passenger_id
     AND (v_grupo_estado = 'fechado' OR v_procura_estado = 'cancelada') THEN
    IF lower(OLD.estado) = 'saiu' AND lower(NEW.estado) = 'activo' THEN
      RAISE EXCEPTION 'Não podes voltar a activo neste grupo.';
    END IF;
    IF lower(OLD.estado) = 'rejeitado'
       AND lower(NEW.estado) IN ('activo', 'pendente') THEN
      RAISE EXCEPTION 'Não podes reactivar este pedido.';
    END IF;
  END IF;

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

    IF lower(NEW.estado) IS NOT DISTINCT FROM lower(OLD.estado)
       AND NEW.ordem_insercao IS DISTINCT FROM OLD.ordem_insercao THEN
      RAISE EXCEPTION 'Não podes alterar a ordem de inserção neste pedido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
GUARD_REVERT_SQL
  if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_SQL}" 2>&1; then
    echo "ERRO: prova passou com guards antigos" >&2
    exit 7
  fi
  echo "==> OK: fail-on-old guards B2"
  exit 0
fi

echo "==> main + 170000 — base ${DB}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
apply_migrations_to_db "${DB}"
run_proof "${DB}" "main→#244"

echo ""
echo "==> Prova concluída (exit 0)"
