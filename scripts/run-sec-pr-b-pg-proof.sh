#!/usr/bin/env bash
# Prova PostgreSQL: Security PR B (replay completo + regressão main)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
BOOTSTRAP_SQL="${ROOT}/supabase/tests/bootstrap_local_supabase.sql"
LOCALFIX_PL="${ROOT}/supabase/tests/localfix_migration_sql.pl"
STUBS_SQL="${ROOT}/supabase/tests/sec_pr_b_pg_proof_stubs.sql"
ASSERT_SQL="${ROOT}/supabase/tests/sec_pr_b_pg_proof_assertions.sql"
MAIN_REGRESS_SQL="${ROOT}/supabase/tests/sec_pr_b_main_regress_assertions.sql"
MIG_SEC_B="20261010100000_sec_pr_b_push_webhook_grants_create_proposal.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado. Instalar PostgreSQL (17+)." >&2
  exit 2
fi

if ! sudo -u postgres psql -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "==> A arrancar PostgreSQL..."
  sudo pg_ctlcluster 17 main start 2>/dev/null \
    || sudo pg_ctlcluster 16 main start 2>/dev/null \
    || sudo service postgresql start \
    || true
fi

if ! sudo -u postgres psql -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "ERRO: PostgreSQL indisponível (role postgres)." >&2
  exit 2
fi

cleanup_db() {
  if [[ -n "${1:-}" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${1}\";" postgres >/dev/null 2>&1 || true
  fi
}

apply_migrations_to_db() {
  local db_name="$1"
  local skip_sec_b="${2:-0}"
  local psql=(sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}")

  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${ROLES_FIRST}"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${BOOTSTRAP_SQL}"

  shopt -s nullglob
  for f in "${ROOT}"/supabase/migrations/*.sql; do
    base="$(basename "$f")"
    if [[ "${skip_sec_b}" == "1" && "${base}" == "${MIG_SEC_B}" ]]; then
      echo "       skip ${base} (simula main antes PR B)"
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

DB="sec_pr_b_proof_$$"
MAIN_DB="sec_pr_b_main_baseline_$$"
trap 'cleanup_db "${DB}"; cleanup_db "${MAIN_DB}"' EXIT

echo "==> Criar BD ${DB} (replay completo incl. PR B)"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB}\";" postgres
apply_migrations_to_db "${DB}" 0

echo "==> Stubs Vault + log pg_net"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${STUBS_SQL}"

echo "==> Asserções PR B"
if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB}" -f "${ASSERT_SQL}"; then
  echo "ERRO: asserções PR B falharam." >&2
  exit 3
fi

echo ""
echo "==> Regressão: checks sec_pr_b devem FALHAR em main (sem migração ${MIG_SEC_B})"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${MAIN_DB}\";" postgres
apply_migrations_to_db "${MAIN_DB}" 1
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${MAIN_DB}" -f "${STUBS_SQL}"

set +e
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${MAIN_DB}" -f "${MAIN_REGRESS_SQL}" >/tmp/sec_pr_b_main_regress.out 2>&1
MAIN_EXIT=$?
set -e

if [[ "${MAIN_EXIT}" -eq 0 ]]; then
  echo "ERRO: regressão main passou — devia falhar (prova PR B ainda não necessária)." >&2
  cat /tmp/sec_pr_b_main_regress.out >&2
  exit 5
fi

if ! grep -q 'REGRESS_OK: main aceitou create_proposal com grupo de outra procura' /tmp/sec_pr_b_main_regress.out; then
  echo "ERRO: regressão main não confirmou create_proposal permissivo." >&2
  cat /tmp/sec_pr_b_main_regress.out >&2
  exit 6
fi

echo "OK regressão main: exit ${MAIN_EXIT} (create_proposal cross-grupo aceite antes sec_pr_b)"
grep -E 'REGRESS_OK|REGRESS_FAIL|REGRESS_UNEXPECTED' /tmp/sec_pr_b_main_regress.out | head -5

echo ""
echo "==> Prova sec_pr_b concluída com sucesso (exit 0)"
