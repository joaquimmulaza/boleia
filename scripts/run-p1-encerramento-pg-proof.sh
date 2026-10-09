#!/usr/bin/env bash
# Prova PostgreSQL P1 encerramento (regras 1 e 3).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_TERM="${ROOT}/supabase/tests/p1_terminate_confirm_idempotent_pg_proof.sql"
PROOF_LEAVE="${ROOT}/supabase/tests/p1_leave_passenger_driver_notif_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
BOOTSTRAP_SQL="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
LOCALFIX_PL="${ROOT}/supabase/tests/localfix_migration_sql.pl"
MIG_P1="20261009200000_p1_encerramento_gaps.sql"
PROOF_RESERVADO="${ROOT}/supabase/tests/p1_leave_passenger_reservado_saiu_pg_proof.sql"
PROOF_JA_ENCERRADO="${ROOT}/supabase/tests/p1_terminate_ja_encerrado_pg_proof.sql"
PROOF_DRIVER_NO_NOTIF="${ROOT}/supabase/tests/p1_leave_driver_caller_no_notif_pg_proof.sql"
SKIP_MIG_P1="${SKIP_MIG_P1:-0}"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado." >&2
  exit 2
fi

if ! sudo -u postgres psql -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "==> A arrancar PostgreSQL..."
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

  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${ROLES_FIRST}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${BOOTSTRAP_SQL}"

  shopt -s nullglob
  for f in "${ROOT}"/supabase/migrations/*.sql; do
    base="$(basename "$f")"
    if [[ "${SKIP_MIG_P1}" == "1" && "${base}" == "${MIG_P1}" ]]; then
      echo "       skip ${base} (SKIP_MIG_P1=1)"
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

DB="p1_encerramento_proof_$$"
trap 'cleanup_db "${DB}"' EXIT

echo "==> Criar BD ${DB}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
apply_migrations_to_db "${DB}"

echo "==> Stub pg_net (push trigger em notificacoes)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f - <<'STUB'
CREATE SCHEMA IF NOT EXISTS net;
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  headers jsonb DEFAULT '{}'::jsonb,
  body jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE sql
AS $$ SELECT 1; $$;
STUB

echo "==> Prova terminate idempotente"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_TERM}"

echo "==> Prova leave_passenger notificação"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_LEAVE}"

echo "==> Prova leave_passenger reservado → saiu (regressão #249)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_RESERVADO}"

echo "==> Prova terminate ja_encerrado (sem confirmação prévia)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_JA_ENCERRADO}"

echo "==> Prova leave_passenger sem notif quando caller é motorista"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF_DRIVER_NO_NOTIF}"

echo "==> OK P1 encerramento PG proofs"
