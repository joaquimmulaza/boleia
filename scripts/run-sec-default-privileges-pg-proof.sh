#!/usr/bin/env bash
# Prova PostgreSQL: todas as migrações + asserções sec_default_privileges (a–e).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="sec_default_priv_proof_$$"
PROOF_SQL="${ROOT}/supabase/tests/sec_default_privileges_pg_proof.sql"
APPLY="${ROOT}/scripts/apply-all-migrations-local.sh"

if ! command -v psql >/dev/null 2>&1; then
  echo "ERRO: psql não encontrado. Instale PostgreSQL (apt install postgresql)." >&2
  exit 2
fi

if ! sudo -u postgres psql -c 'SELECT 1' postgres >/dev/null 2>&1; then
  echo "==> A arrancar cluster PostgreSQL (pg_ctlcluster)..."
  sudo pg_ctlcluster 16 main start || sudo service postgresql start || true
fi

cleanup() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Criar base ${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\";" postgres

echo "==> Aplicar bootstrap + todas as migrações"
"${APPLY}" "${DB_NAME}"

echo "==> Asserções sec_default_privileges"
cd "${ROOT}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${PROOF_SQL}"

echo "==> Prova concluída com sucesso (exit 0)"
