#!/usr/bin/env bash
# Prova PostgreSQL — dias de viagem do acordo (Regra 5 P0).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/faltas_dias_acordo_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
BOOTSTRAP_SQL="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
LOCALFIX_PL="${ROOT}/supabase/tests/localfix_migration_sql.pl"
SKIP_DIAS_MIG="${SKIP_DIAS_MIG:-0}"
MIG_DIAS_PREFIX="20261015143000"

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
    if [[ "${SKIP_DIAS_MIG}" == "1" && "${base}" == ${MIG_DIAS_PREFIX}* ]]; then
      echo "       skip ${base} (SKIP_DIAS_MIG=1 — fail-on-old)"
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

DB_PASS="boleia_dias_acordo_pass_$$"
DB_FAIL="boleia_dias_acordo_fail_$$"

trap 'cleanup_db "$DB_PASS"; cleanup_db "$DB_FAIL"' EXIT

echo "==> DB com migração dias acordo (esperado PASS)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_PASS}\";" postgres
apply_migrations_to_db "${DB_PASS}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_PASS}" -f "${PROOF_SQL}"

echo "==> DB sem migração dias acordo (esperado FAIL-on-old)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_FAIL}\";" postgres
SKIP_DIAS_MIG=1 apply_migrations_to_db "${DB_FAIL}"
if sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_FAIL}" -f "${PROOF_SQL}" >/tmp/dias_acordo_fail_old.log 2>&1; then
  echo "ERRO: prova devia falhar sem migração dias acordo" >&2
  exit 3
fi
if ! grep -qE 'FAIL|BCF03|does not exist' /tmp/dias_acordo_fail_old.log; then
  echo "ERRO: fail-on-old não detectado:" >&2
  tail -20 /tmp/dias_acordo_fail_old.log >&2
  exit 3
fi

echo "==> Prova dias acordo OK (PASS com migração; FAIL-on-old sem migração)"
