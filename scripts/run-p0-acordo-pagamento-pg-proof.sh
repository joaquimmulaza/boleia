#!/usr/bin/env bash
# Prova PostgreSQL P0: cadeia main→#244→P0 e main→#243→#244→P0
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/p0_acordo_pagamento_estados_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
P0_AUTH_OVERRIDES="${ROOT}/supabase/tests/bootstrap_p0_auth_overrides.sql"
# Prefer ficheiros do repo; fallback git ref (main ou override).
P0_PROOF_GIT_REF="${P0_PROOF_GIT_REF:-origin/main}"
CANCEL_PROCURA_REF="${CANCEL_PROCURA_REF:-origin/cursor/cancel-procura-membros}"
PGPORT="${PGPORT:-5432}"
export PGPORT
MIG_160000="20261009160000_sec_default_privileges.sql"
MIG_170000="20261009170000_cancel_procura_membros_saiu.sql"
MIG_180000="20261009180000_p0_acordo_pagamento_estados.sql"
TMP_MIG_DIR=""

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado." >&2
  exit 2
fi

if ! sudo -u postgres psql -p "${PGPORT}" -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "==> A arrancar PostgreSQL (porta ${PGPORT})..."
  sudo pg_ctlcluster 16 main start || sudo service postgresql start || true
fi

cleanup_tmp() {
  if [[ -n "${TMP_MIG_DIR}" && -d "${TMP_MIG_DIR}" ]]; then
    rm -rf "${TMP_MIG_DIR}"
  fi
}

cleanup_db() {
  if [[ -n "${1:-}" ]]; then
    sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${1}\";" postgres >/dev/null 2>&1 || true
  fi
}

resolve_repo_file() {
  local rel="$1"
  local dest="$2"
  if [[ -f "${ROOT}/${rel}" ]]; then
    cp "${ROOT}/${rel}" "${dest}"
  else
    git show "${P0_PROOF_GIT_REF}:${rel}" >"${dest}"
  fi
}

resolve_migration_file() {
  local base="$1"
  local dest="$2"
  if [[ -f "${ROOT}/supabase/migrations/${base}" ]]; then
    cp "${ROOT}/supabase/migrations/${base}" "${dest}"
    return 0
  fi
  local ref
  for ref in "${CANCEL_PROCURA_REF}" "${P0_PROOF_GIT_REF}" origin/cursor/cancel-procura-membros; do
    if git show "${ref}:supabase/migrations/${base}" >"${dest}" 2>/dev/null; then
      return 0
    fi
  done
  echo "ERRO: migração ${base} não encontrada no repo nem em refs git." >&2
  return 1
}

apply_migrations_to_db() {
  local db_name="$1"
  local mode="$2"
  local bootstrap_sql="$3"
  local localfix_pl="$4"
  local extra_160000="${5:-}"
  local extra_170000="${6:-}"

  local psql=(sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${db_name}")
  local applied_170000=0

  sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${db_name}" -f "${ROLES_FIRST}"
  sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${db_name}" -f "${bootstrap_sql}"
  sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${db_name}" -f "${P0_AUTH_OVERRIDES}"

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
    if [[ "${base}" == "${MIG_180000}" && -n "${extra_170000}" && "${applied_170000}" -eq 0 ]]; then
      if [[ ! -f "${ROOT}/supabase/migrations/${MIG_170000}" ]]; then
        echo "       -> ${MIG_170000} (runtime #244 ${CANCEL_PROCURA_REF})"
        "${psql[@]}" -f "${extra_170000}"
        applied_170000=1
      fi
    fi
    if [[ "${mode}" == "com-243" && "${base}" == "${MIG_180000}" && -n "${extra_160000}" ]]; then
      if [[ ! -f "${extra_160000}.applied" ]]; then
        echo "       -> ${MIG_160000} (runtime #243)"
        "${psql[@]}" -f "${extra_160000}"
        touch "${extra_160000}.applied"
      fi
    fi
    echo "       -> ${base}"
    if ! "${psql[@]}" -f "$mig_src" >/tmp/mig_"${db_name}"_"${base}".log 2>&1; then
      echo "FALHOU: ${base} (modo ${mode})" >&2
      tail -40 /tmp/mig_"${db_name}"_"${base}".log >&2
      return 4
    fi
  done
}

run_proof() {
  local db="$1"
  local label="$2"
  echo "==> Asserções P0 (${label})"
  if ! sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${db}" -f "${PROOF_SQL}"; then
    echo "FALHOU: asserções P0 (${label})" >&2
    return 5
  fi
}

TMP_MIG_DIR="${ROOT}/.pg-proof-tmp-$$"
mkdir -p "${TMP_MIG_DIR}"
chmod a+rx "${TMP_MIG_DIR}"
trap 'cleanup_tmp; cleanup_db "${DB_A:-}"; cleanup_db "${DB_B:-}"' EXIT

BOOT="${TMP_MIG_DIR}/bootstrap.sql"
LOCALFIX="${TMP_MIG_DIR}/localfix.pl"
MIG_160000_PATH="${TMP_MIG_DIR}/${MIG_160000}"
MIG_170000_PATH="${TMP_MIG_DIR}/${MIG_170000}"

resolve_repo_file "supabase/tests/bootstrap_local_supabase.sql" "${BOOT}"
resolve_repo_file "supabase/tests/bootstrap_p0_auth_overrides.sql" "${TMP_MIG_DIR}/bootstrap_p0_auth_overrides.sql"
P0_AUTH_OVERRIDES="${TMP_MIG_DIR}/bootstrap_p0_auth_overrides.sql"
resolve_repo_file "supabase/tests/localfix_migration_sql.pl" "${LOCALFIX}"
resolve_migration_file "${MIG_160000}" "${MIG_160000_PATH}"
resolve_migration_file "${MIG_170000}" "${MIG_170000_PATH}"

DB_A="p0_acordo_proof_a_$$"
DB_B="p0_acordo_proof_b_$$"

echo "==> (a) main→#244→P0 sem 160000 — ${DB_A}"
sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_A}\";" postgres
apply_migrations_to_db "${DB_A}" "sem-160000" "${BOOT}" "${LOCALFIX}" "" "${MIG_170000_PATH}"
run_proof "${DB_A}" "main→#244→P0"

echo "==> (b) main→#243→#244→P0 — ${DB_B}"
sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_B}\";" postgres
apply_migrations_to_db "${DB_B}" "com-243" "${BOOT}" "${LOCALFIX}" "${MIG_160000_PATH}" "${MIG_170000_PATH}"
run_proof "${DB_B}" "main→#243→#244→P0"

echo "==> Prova P0 concluída (exit 0)"
