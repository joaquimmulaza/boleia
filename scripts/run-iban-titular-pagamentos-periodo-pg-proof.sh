#!/usr/bin/env bash
# Prova PostgreSQL: revoke iban_titular + renovação quota integral (replay migrations).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROOF_SQL="${ROOT}/supabase/tests/iban_titular_pagamentos_periodo_pg_proof.sql"
ROLES_FIRST="${ROOT}/supabase/tests/bootstrap_roles_first.sql"
P0_AUTH_OVERRIDES="${ROOT}/supabase/tests/bootstrap_p0_auth_overrides.sql"
PGVERSION="${PGVERSION:-17}"
PGPORT="${PGPORT:-5432}"
export PGPORT
DB_NAME="iban_titular_proof_$$"
TMP_MIG_DIR=""

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado." >&2
  exit 2
fi

start_pg() {
  if sudo -u postgres psql -p "${PGPORT}" -c 'SELECT 1' postgres >/dev/null 2>&1; then
    return 0
  fi
  echo "==> A arrancar PostgreSQL ${PGVERSION}/main (porta ${PGPORT})..."
  if command -v pg_ctlcluster >/dev/null 2>&1 && [[ -d "/etc/postgresql/${PGVERSION}/main" ]]; then
    sudo pg_ctlcluster "${PGVERSION}" main start
  else
    echo "AVISO: cluster ${PGVERSION}/main indisponível; tentar service postgresql." >&2
    sudo service postgresql start || true
  fi
}
start_pg

cleanup() {
  if [[ -n "${TMP_MIG_DIR}" && -d "${TMP_MIG_DIR}" ]]; then
    rm -rf "${TMP_MIG_DIR}"
  fi
  sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

TMP_MIG_DIR="${ROOT}/.pg-proof-iban-$$"
mkdir -p "${TMP_MIG_DIR}"
BOOT="${TMP_MIG_DIR}/bootstrap.sql"
LOCALFIX="${TMP_MIG_DIR}/localfix.pl"

cp "${ROOT}/supabase/tests/bootstrap_local_supabase.sql" "${BOOT}"
cp "${ROOT}/supabase/tests/localfix_migration_sql.pl" "${LOCALFIX}"

echo "==> Criar base ${DB_NAME}"
sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\";" postgres

psql=(sudo -u postgres psql -p "${PGPORT}" -v ON_ERROR_STOP=1 -d "${DB_NAME}")
"${psql[@]}" -f "${ROLES_FIRST}"
"${psql[@]}" -f "${BOOT}"
"${psql[@]}" -f "${P0_AUTH_OVERRIDES}"

shopt -s nullglob
for f in "${ROOT}"/supabase/migrations/*.sql; do
  base="$(basename "$f")"
  mig_src="$f"
  if [[ "${base}" == "20260329161035_remote_schema.sql" ]]; then
    mig_src="${TMP_MIG_DIR}/remote_schema.localfix.sql"
    perl "${LOCALFIX}" <"$f" >"$mig_src"
  fi
  echo "       -> ${base}"
  if ! "${psql[@]}" -f "$mig_src" >/tmp/mig_"${DB_NAME}"_"${base}".log 2>&1; then
    echo "FALHOU: ${base}" >&2
    tail -40 /tmp/mig_"${DB_NAME}"_"${base}".log >&2
    exit 4
  fi
done

echo "==> Asserções iban_titular + renovação"
if ! "${psql[@]}" -f "${PROOF_SQL}"; then
  echo "FALHOU: prova PG" >&2
  exit 5
fi

echo "==> Prova concluída (exit 0)"
