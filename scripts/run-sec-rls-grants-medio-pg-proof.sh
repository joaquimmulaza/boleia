#!/usr/bin/env bash
# Prova PostgreSQL local: fix(sec) RLS/grants tabelas médias + storage comprovativos.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DB_NAME="sec_rls_grants_medio_proof_$$"
SQL_FILE="${ROOT}/supabase/tests/sec_rls_grants_medio_pg_proof.sql"

cleanup() {
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";" postgres >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Criar base de teste ${DB_NAME}"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"${DB_NAME}\";" postgres

echo "==> Aplicar stubs + migração + asserções"
cd "${ROOT}"
if ! sudo -u postgres psql -v ON_ERROR_STOP=1 -d "${DB_NAME}" -f "${SQL_FILE}"; then
  echo "==> Prova FALHOU (psql exit $?)" >&2
  exit 3
fi

echo "==> Prova concluída com sucesso (exit 0)"
