#!/usr/bin/env bash
# Prova PostgreSQL — pacote notificações (leave_passenger + link).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF="${ROOT}/supabase/tests/notif_pacote_leave_passenger_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
BOOTSTRAP_SQL="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
LOCALFIX_PL="${ROOT}/supabase/tests/localfix_migration_sql.pl"

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

DB="notif_pacote_proof_$$"
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

echo "==> Prova leave_passenger pacote notificações"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${PROOF}"

echo "==> OK notificacoes-pacote PG proof"
