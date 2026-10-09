#!/usr/bin/env bash
# Prova PostgreSQL cancel_procura: cadeia real de migrações em duas ordens.
# (a) main→#244 sem 20261009160000
# (b) main→#243→#244 com 160000 obtido de origin/cursor/sec-default-privileges em runtime
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/cancel_procura_membros_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
SEC_BRANCH="${SEC_DEFAULT_PRIVILEGES_REF:-origin/cursor/sec-default-privileges}"
MIG_160000="20261009160000_sec_default_privileges.sql"
TMP_MIG_DIR=""

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado. Instale PostgreSQL (apt install postgresql)." >&2
  exit 2
fi

if ! sudo -u postgres psql -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "==> A arrancar cluster PostgreSQL..."
  sudo pg_ctlcluster 16 main start || sudo service postgresql start || true
fi

cleanup_tmp() {
  if [[ -n "${TMP_MIG_DIR}" && -d "${TMP_MIG_DIR}" ]]; then
    rm -rf "${TMP_MIG_DIR}"
  fi
}

cleanup_db() {
  if [[ -n "${1:-}" ]]; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${1}\";" postgres >/dev/null 2>&1 || true
  fi
}

fetch_bootstrap_and_apply() {
  local dest_bootstrap="$1"
  local dest_apply="$2"
  local dest_localfix="$3"
  git show "${SEC_BRANCH}:supabase/tests/bootstrap_local_supabase.sql" >"${dest_bootstrap}"
  git show "${SEC_BRANCH}:scripts/apply-all-migrations-local.sh" >"${dest_apply}"
  git show "${SEC_BRANCH}:supabase/tests/localfix_migration_sql.pl" >"${dest_localfix}"
  chmod a+r "${dest_bootstrap}" "${dest_apply}" "${dest_localfix}"
  chmod +x "${dest_apply}"
}

apply_migrations_to_db() {
  local db_name="$1"
  local mode="$2"
  local bootstrap_sql="$3"
  local apply_script="$4"
  local localfix_pl="$5"
  local extra_160000="${6:-}"

  local psql=(sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}")

  echo "    -> bootstrap_roles_first.sql"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${ROLES_FIRST}"

  echo "    -> bootstrap (#243)"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${bootstrap_sql}"

  echo "    -> migrações (modo ${mode})"
  shopt -s nullglob
  for f in "${ROOT}"/supabase/migrations/*.sql; do
    base="$(basename "$f")"
    if [[ "${mode}" == "sem-160000" && "${base}" == "${MIG_160000}" ]]; then
      echo "       skip ${base}"
      continue
    fi
    mig_src="$f"
    if [[ "${base}" == "20260329161035_remote_schema.sql" ]]; then
      mig_src="/tmp/${base}.localfix.${db_name}.sql"
      perl "${localfix_pl}" <"$f" >"$mig_src"
    fi
    if [[ "${mode}" == "com-243" && "${base}" == "20261009170000_cancel_procura_membros_saiu.sql" && -n "${extra_160000}" ]]; then
      if [[ ! -f "${extra_160000}.applied" ]]; then
        echo "       -> ${MIG_160000} (runtime #243)"
        "${psql[@]}" -f "${extra_160000}"
        touch "${extra_160000}.applied"
      fi
    fi
    echo "       -> ${base}"
    if ! "${psql[@]}" -f "$mig_src" >/tmp/mig_"${db_name}"_"${base}".log 2>&1; then
      echo "FALHOU: ${base} (modo ${mode})" >&2
      tail -30 /tmp/mig_"${db_name}"_"${base}".log >&2
      return 4
    fi
  done
}

run_proof_case() {
  local db_name="$1"
  local label="$2"
  echo ""
  echo "==> Prova SQL (${label})"
  if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${db_name}" -f "${PROOF_SQL}"; then
    echo "FALHOU: asserções cancel_procura (${label})" >&2
    return 5
  fi
  echo "==> OK modo ${label}"
}

TMP_MIG_DIR="$(mktemp -d)"
chmod a+rx "${TMP_MIG_DIR}"
trap 'cleanup_tmp; cleanup_db "${DB_A:-}"; cleanup_db "${DB_B:-}"' EXIT

BOOT_A="${TMP_MIG_DIR}/bootstrap.sql"
APPLY_A="${TMP_MIG_DIR}/apply-all.sh"
LOCALFIX="${TMP_MIG_DIR}/localfix.pl"
MIG_160000_PATH="${TMP_MIG_DIR}/${MIG_160000}"

echo "==> Obter bootstrap/apply/localfix de ${SEC_BRANCH}"
fetch_bootstrap_and_apply "${BOOT_A}" "${APPLY_A}" "${LOCALFIX}"
git show "${SEC_BRANCH}:supabase/migrations/${MIG_160000}" >"${MIG_160000_PATH}"
chmod a+r "${MIG_160000_PATH}"

DB_A="cancel_procura_proof_a_$$"
DB_B="cancel_procura_proof_b_$$"

echo "==> (a) main→#244 sem 160000 — base ${DB_A}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_A}\";" postgres
apply_migrations_to_db "${DB_A}" "sem-160000" "${BOOT_A}" "${APPLY_A}" "${LOCALFIX}" ""
run_proof_case "${DB_A}" "main→#244 (sem 160000)"

echo "==> (b) main→#243→#244 — base ${DB_B}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_B}\";" postgres
apply_migrations_to_db "${DB_B}" "com-243" "${BOOT_A}" "${APPLY_A}" "${LOCALFIX}" "${MIG_160000_PATH}"
run_proof_case "${DB_B}" "main→#243→#244"

echo ""
echo "==> Ambas as provas concluídas com sucesso (exit 0)"
